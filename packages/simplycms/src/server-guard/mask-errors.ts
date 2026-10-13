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
  return parts.join('\nКвитка: ');
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
  if (typeof error === 'object' && error !== null && masked.has(error)) {
    return error;
  }
  const id = (options.newId ?? defaultId)();
  const log = options.log ?? ((line: string) => console.error(line));
  log(`[server] Непередбачена помилка ${id}: ${redactUrls(describe(error))}`);
  const result = new Error(maskedErrorMessage(id));
  masked.add(result);
  return result;
}
