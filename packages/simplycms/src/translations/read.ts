import { sql, type SQL } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { TranslationRow } from 'simplycms/domain/translations';
import { assertIdent, type TranslatableEntity } from './specs';

/** Рядок перекладу з БД: значення полів і `source_hashes` (мова → цей запис). */
export type StoredTranslation = TranslationRow & {
  readonly values: Readonly<Record<string, string | null>>;
  readonly hashes: Readonly<Record<string, string>>;
};

/** Код основної мови магазину (рівно одна — тримає `languages_guard`). */
export async function primaryLocaleCode(db: ActorDb): Promise<string> {
  const res = await db.execute<{ code: string }>(
    sql`select code from public.languages where is_default`,
  );
  const code = res.rows[0]?.code;
  if (!code) throw new Error('[simplycms/translations] немає основної мови');
  return code;
}

/**
 * Переклади сутностей одним запитом: id → мова → рядок. Сутність без жодного
 * рядка в мапі відсутня (викликач трактує як «перекладів немає»).
 */
export async function loadTranslations(
  db: ActorDb,
  spec: TranslatableEntity,
  ids: readonly string[],
): Promise<Map<string, Map<string, StoredTranslation>>> {
  const out = new Map<string, Map<string, StoredTranslation>>();
  if (ids.length === 0) return out;
  const fk = sql.raw(assertIdent(spec.fk));
  const cols = sql.join(
    spec.fields.map((f) => sql.raw(assertIdent(f))),
    sql`, `,
  );
  const res = await db.execute<Record<string, unknown>>(sql`
    select ${fk} as owner, locale, ${cols}, source_hashes
      from ${sql.raw(assertIdent(spec.table))}
     where ${fk} in (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})`);
  for (const r of res.rows) {
    const owner = String(r.owner);
    const values: Record<string, string | null> = {};
    for (const f of spec.fields) values[f] = (r[f] as string | null) ?? null;
    const byLocale = out.get(owner) ?? new Map<string, StoredTranslation>();
    byLocale.set(String(r.locale), {
      values,
      hashes: (r.source_hashes as Record<string, string>) ?? {},
    });
    out.set(owner, byLocale);
  }
  return out;
}

/**
 * Читання з fallback на основну мову для вітрини (Task 15/16): значення поля
 * мови, а коли його немає — джерела. Псевдоніми фіксовані: `t_loc` (мова
 * запиту), `t_src` (основна). `joinOn(owner)` — пара LEFT JOIN-ів до таблиці
 * перекладів сутності, `owner` — вираз її id у запиті викликача. `fallback[поле]` —
 * булева ознака «текст узято з основної мови» (у мові порожньо, у джерелі є): ознака
 * з ДАНИХ, а не з порівняння текстів, тож переклад, буквально рівний джерелу
 * («iPhone 15»), fallback не вважається (І37).
 */
export function withFallback(
  spec: TranslatableEntity,
  locale: string,
  primary: string,
): {
  columns: Record<string, SQL>;
  fallback: Record<string, SQL>;
  joinOn: (owner: SQL) => SQL;
} {
  const table = sql.raw(assertIdent(spec.table));
  const fk = sql.raw(assertIdent(spec.fk));
  const columns: Record<string, SQL> = {};
  const fallback: Record<string, SQL> = {};
  for (const f of spec.fields) {
    const c = sql.raw(assertIdent(f));
    columns[f] = sql`coalesce(t_loc.${c}, t_src.${c})`;
    fallback[f] = sql`(t_loc.${c} is null and t_src.${c} is not null)`;
  }
  return {
    columns,
    fallback,
    joinOn: (owner) => sql`
      left join ${table} t_loc on t_loc.${fk} = ${owner} and t_loc.locale = ${locale}
      left join ${table} t_src on t_src.${fk} = ${owner} and t_src.locale = ${primary}`,
  };
}
