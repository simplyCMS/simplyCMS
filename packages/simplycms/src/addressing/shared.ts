import { sql, type SQL } from 'drizzle-orm';
import { SLUG_FORMAT, allocateSlug } from 'simplycms/domain/slugs';
import { ValidationError } from 'simplycms/admin-server/impl';
import type { ActorDb } from 'simplycms/db';

// Спільне для реєстрів адрес і токенів (І22): обидва алокують slug ОДНОЮ
// функцією `allocateSlug` проти множини зайнятих значень, яку читає один запит.

/** Коди всіх мов: сегмент URL мови — `lower(code)`, його slug займати не можна. */
export async function languageSegments(db: ActorDb): Promise<string[]> {
  const res = await db.execute<{ code: string }>(
    sql`select code from public.languages`,
  );
  return res.rows.map((r) => r.code.toLowerCase());
}

/** Код основної мови; без неї копіювати адреси нема з чого. */
export async function primaryLocale(db: ActorDb): Promise<string> {
  const res = await db.execute<{ code: string }>(
    sql`select code from public.languages where is_default`,
  );
  const code = res.rows[0]?.code;
  if (!code) throw new Error('[addressing] немає основної мови');
  return code;
}

/** Масив рядків як `text[]`-параметр (drizzle розгортає JS-масив у список). */
export const textArray = (values: readonly string[]): SQL =>
  sql`array[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;

/**
 * Умова «колонка — одна з баз або `база-…`» для пакета баз. Ланцюг `OR`, а не
 * `LIKE ANY (array)`: лише ланцюг планувальник розкладає на BitmapOr по індексу
 * унікальності (`COLLATE "C"` дає префіксний діапазон), а `LIKE ANY` — seq scan
 * (EXPLAIN у звіті Task 5). Slug складається з `[a-z0-9-]`, метасимволів LIKE
 * немає.
 */
export function candidateAny(column: SQL, bases: readonly string[]): SQL {
  return sql`(${sql.join(
    bases.map((b) => sql`(${column} = ${b} or ${column} like ${`${b}-%`})`),
    sql` or `,
  )})`;
}

/** Відмова формату: одна проблема на полі `path`. */
export function invalidFormat(field: string): ValidationError {
  return new ValidationError([{ path: [field], code: 'invalid_format' }]);
}

/** Зарезервований сегмент (`path_reserved`, І19): значення поза переліком. */
export function reservedValue(field: string): ValidationError {
  return new ValidationError([{ path: [field], code: 'invalid_value' }]);
}

export function assertSlugFormat(value: string, field: string): void {
  if (!SLUG_FORMAT.test(value)) throw invalidFormat(field);
}

/**
 * Вільний slug у пам'яті. Зайняті (`taken`) поповнюються ТУТ після кожної
 * алокації: два товари пакета з однаковою базою інакше отримали б один slug.
 */
export function allocateIn(
  base: string,
  taken: Set<string>,
  isReserved: (candidate: string) => boolean = () => false,
): string {
  const slug = allocateSlug(base, (c) => taken.has(c) || isReserved(c));
  taken.add(slug);
  return slug;
}

/** Postgres 23505 (drizzle перезагортає помилку драйвера в `.cause`). */
export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (cause as { code?: string } | null)?.code === '23505';
}
