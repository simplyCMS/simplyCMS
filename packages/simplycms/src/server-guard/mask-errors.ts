import { isNotFound, isRedirect } from '@tanstack/react-router';
import { isDomainErrorName } from 'simplycms/contracts/domain-errors';
import { maskedErrorMessage } from 'simplycms/contracts/masked-error';
import { isProductionRuntime, redactUrls } from 'simplycms/env';

type Env = Readonly<Record<string, string | undefined>>;

/** Залежності маскування: у проді їх задає `process.env`/`console.error`, тест підміняє. */
export interface MaskOptions {
  readonly env?: Env;
  readonly log?: (line: string) => void;
  readonly newId?: () => string;
}

/**
 * Помилки, що вже пройшли маскування: server function, викликана з іншої
 * server function (або двічі на шляху SSR), не повинна отримати другий
 * ідентифікатор і другий запис у лозі.
 */
const masked = new WeakSet<object>();

/**
 * Одна сирова помилка → один результат: серіалізаційний адаптер питає про ту
 * саму помилку двічі (`test`, потім `toSerializable`), а seroval — ще й на
 * кожному проході. Без пам'яті кожне питання давало б новий ідентифікатор і
 * новий запис у лозі.
 */
const results = new WeakMap<object, Error>();

const defaultId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8);

/** Повний текст помилки для логу: стек + ланцюжок `cause` (Drizzle ховає pg-помилку там). */
function describe(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    parts.push(
      current instanceof Error
        ? (current.stack ?? `${current.name}: ${current.message}`)
        : String(current),
    );
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join('\nПричина: ');
}

/** Передається клієнту як є: керування потоком Start, готові відповіді, доменні помилки з кодом. */
function isPassThrough(error: unknown): boolean {
  if (isRedirect(error) || isNotFound(error)) return true;
  if (error instanceof Response) return true;
  return error instanceof Error && isDomainErrorName(error.name);
}

/**
 * Р23: непередбачена помилка не доходить до клієнта з текстом Postgres чи
 * `connect ECONNREFUSED host:port`. У проді замінює її на загальне
 * повідомлення з ідентифікатором, а повну помилку (через `redactUrls`) пише в
 * лог із тим самим ідентифікатором. Поза продом повертає помилку як є.
 *
 * Предикат «доменна» — членство в `DOMAIN_ERROR_NAME`, а не перелік класів:
 * новий член родини проходить автоматично, адаптер серіалізації донесе його
 * `name` і поля.
 */
export function maskUnexpectedError(
  error: unknown,
  options: MaskOptions = {},
): unknown {
  const env = options.env ?? process.env;
  if (!isProductionRuntime(env) || isPassThrough(error)) return error;
  if (typeof error === 'object' && error !== null) {
    if (masked.has(error)) return error;
    const known = results.get(error);
    if (known) return known;
  }
  const id = (options.newId ?? defaultId)();
  const log = options.log ?? ((line: string) => console.error(line));
  log(`[server] Непередбачена помилка ${id}: ${redactUrls(describe(error))}`);
  const result = new Error(maskedErrorMessage(id));
  masked.add(result);
  if (typeof error === 'object' && error !== null) results.set(error, result);
  return result;
}

/**
 * Серіалізаційний адаптер (I1): помилка, кинута в лоадері чи `beforeLoad` НЕ
 * через server function, інакше потрапила б у payload дегідратації як є
 * (`ShallowErrorPlugin` несе `message`). Адаптери застосунку йдуть у seroval
 * ПЕРЕД ним, а доменний адаптер — перед цим, тож сюди доходять лише
 * непередбачені; доменні, керування потоком і вже замасковані повертають
 * `false`.
 */
export function isMaskableError(value: unknown): value is Error {
  return value instanceof Error && maskUnexpectedError(value) !== value;
}

/** Форма, що їде на клієнт замість помилки: лише замасковане повідомлення. */
export function toMaskedPayload(error: Error): { readonly message: string } {
  return { message: (maskUnexpectedError(error) as Error).message };
}

/**
 * Тіло глобальної function-middleware (Р23): `next()` кидає помилку будь-якого
 * рівня ланцюга; непередбачена замінюється на замасковану. Винесено з host-у,
 * щоб тестувати як звичайну функцію, а не лізти в `options` міддлвари Start.
 */
export async function maskAround<T>(next: () => Promise<T>): Promise<T> {
  try {
    return await next();
  } catch (error) {
    throw maskUnexpectedError(error);
  }
}
