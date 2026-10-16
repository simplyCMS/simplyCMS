import { sql } from 'drizzle-orm';
import {
  ValidationError,
  type ValidationIssue,
} from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';

// Спільне для дочірніх колекцій агрегата (М1, Task 12): контекст команди, крок
// «перевірити, потім записати» і розбір мов.

/** Що знають усі кроки: транзакція, товар, основна мова, відомі мови. */
export interface ChildCtx {
  readonly db: ActorDb;
  readonly productId: string;
  readonly primary: string;
  readonly locales: ReadonlySet<string>;
  /** Модифікації товару ПІСЛЯ команди: наявні + нові − видалені. */
  readonly modificationIds: ReadonlySet<string>;
}

/**
 * Крок команди: перевірка вводу (кидає ДО версії — 400 раніше за 412) і
 * `apply` — запис у транзакції після версії. Окремі фази, бо порядок
 * майстра §3.3 вимагає валідації до звірки версії.
 */
export interface Step {
  apply(): Promise<void>;
}

export const NOOP: Step = { apply: async () => undefined };

export const fail = (
  path: readonly (string | number)[],
  code: ValidationIssue['code'],
): ValidationError => new ValidationError([{ path, code }]);

/** Усі коди мов магазину (будь-який статус): запис у невідому дав би сирий FK-збій. */
export async function knownLocales(db: ActorDb): Promise<Set<string>> {
  const res = await db.execute<{ code: string }>(
    sql`select code from public.languages`,
  );
  return new Set(res.rows.map((r) => r.code));
}

/** Невідома мова в ключах мапи → відмова зі шляхом `at(мова)`. */
export function requireLocales(
  ctx: Pick<ChildCtx, 'locales'>,
  map: Readonly<Record<string, unknown>> | undefined,
  at: (locale: string) => readonly (string | number)[],
): void {
  for (const locale of Object.keys(map ?? {}))
    if (!ctx.locales.has(locale)) throw fail(at(locale), 'invalid_value');
}

/** Дублікат серед `ids` → відмова зі шляхом `at(індекс)`. */
export function requireDistinct(
  ids: readonly string[],
  at: (index: number) => readonly (string | number)[],
): void {
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (seen.has(id)) throw fail(at(i), 'invalid_value');
    seen.add(id);
  });
}

/** `ARRAY[...]::uuid[]` для `= any(...)`. */
export const uuidArray = (ids: readonly string[]) =>
  sql`array[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
