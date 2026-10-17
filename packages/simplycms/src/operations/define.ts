import { z } from 'zod';
import type { AuthzSubject, CoreActor, Operation } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import { VersionMismatchError } from 'simplycms/contracts/domain-errors';

/** Формат id операції (майстер §3.3): `languages.add`, `products.saveDescription`. */
export const OPERATION_ID_FORMAT = /^[a-z][a-z-]*(\.[a-z][a-zA-Z]*)+$/;

/** Контекст, який виконавець передає в `run`: суб'єкт ЯВНИЙ, не з запиту. */
export interface OperationContext {
  readonly subject: AuthzSubject;
  readonly actor: CoreActor;
  /** Транзакція виконавця: уся робота операції — в одній. */
  readonly db: ActorDb;
  /**
   * Хвіст ПІСЛЯ коміту (двофазне стирання файлів, Е6д-14): виконавець викличе
   * `fn` лише коли транзакцію закомічено; при відкаті й replay — ніколи. `fn`
   * не мусить кидати: збій хвоста не маскує результат вже виконаної команди.
   *
   * 🔴 Хвіст лише ДОБИРАЄ намір, який уже записано в транзакції операції
   * (рядок outbox, як `media_erasures`): єдиним носієм наміру він бути не може,
   * бо збій хвоста (падіння процесу, помилка диска) не має губити дію — недобране
   * добере наявний механізм outbox. Другого каналу побічних ефектів це не є.
   */
  readonly afterCommit: (fn: () => Promise<void>) => void;
}

/** Опис операції реєстру — одна форма для serverFn, HTTP і плагінів. */
export interface OperationDef<I, O> {
  /** Формат — `OPERATION_ID_FORMAT`. */
  readonly id: string;
  /** Ключ `AUTHZ_MATRIX`. */
  readonly permission: Operation;
  readonly input: z.ZodType<I>;
  /** Дротова форма відповіді (дати — `z.iso.datetime()`). */
  readonly output: z.ZodType<O>;
  readonly idempotent?: 'create';
  readonly transport?: 'json' | 'multipart';
  /** Відповідь несе `version` → ETag. */
  readonly versioned?: true;
  /** Лише cookie-сесія; Bearer → 403 (механіку дає HTTP-шар). */
  readonly sessionOnly?: true;
  run(ctx: OperationContext, input: I): Promise<O>;
}

/**
 * Чи приймає вхід операції `expectedVersion` (корінь — `z.object` з цим ключем).
 * `If-Match` ↔ `expectedVersion`: заголовок для операції без цього поля схема
 * мовчки відкинула б (strip), тож HTTP-шар відмовляє явно (400), а не вдає,
 * ніби перевірив версію.
 */
export function acceptsExpectedVersion(
  def: OperationDef<unknown, unknown>,
): boolean {
  return (
    def.input instanceof z.ZodObject && 'expectedVersion' in def.input.shape
  );
}

/** Ключ ідемпотентності запиту (механіку реалізує HTTP-шар). */
export interface IdempotencyRequest {
  readonly subjectKey: string;
  readonly key: string;
  readonly fingerprint: Buffer;
}

export type ExecuteResult<O> =
  | { readonly replayed: false; readonly output: O }
  | {
      readonly replayed: true;
      readonly status: number;
      readonly body: unknown;
    };

/**
 * Фіксує опис операції. Некоректний id — помилка модуля при завантаженні, а не
 * 404 на проді: id потрапляє в URL `/api/v1/<op>` і в `scopes` токенів.
 */
export function defineOperation<I, O>(
  def: OperationDef<I, O>,
): OperationDef<I, O> {
  if (!OPERATION_ID_FORMAT.test(def.id))
    throw new Error(
      `[simplycms/operations] id операції має формат ${OPERATION_ID_FORMAT}: «${def.id}»`,
    );
  return def;
}

/**
 * Перевірка версії агрегата, а ПОТІМ хеша джерела (І14): неспівпадіння версії
 * видно першим, навіть коли розійшовся і хеш — клієнт спершу перечитує агрегат.
 * Спільний хелпер, щоб порядок не розійшовся між командами. Викликається в
 * транзакції запису під `FOR NO KEY UPDATE` кореня.
 *
 * @param expectedVersion `undefined` — клієнт версії не передав, перевірки немає.
 * @param hashCheck кидає `SourceChangedError`, якщо хеш джерела застарів.
 */
export function assertVersionThenHash(
  current: number,
  expectedVersion: number | undefined,
  hashCheck: () => void,
): void {
  if (expectedVersion !== undefined && expectedVersion !== current)
    throw new VersionMismatchError(current);
  hashCheck();
}
