import { sql, type SQL } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { textArray } from './shared';

// Кандидати й замки пакетного копіювання адрес/токенів у нову мову (`copy.ts`).
// 🔴 Вибір кандидатів — ОДИН фрагмент на етап: з нього беруть і копіювання, і
// перевірка прогресу `languages.fill`, тож «потребує роботи» й «етап зробить» не
// можуть розійтись (інакше fill крутився б на місці).

/** Поточні адреси основної мови товарів, що не мають поточної адреси в `locale`. */
export const pathCandidates = (
  primary: SQL | string,
  locale: string,
): SQL => sql`
  select p.product_id, p.path from public.url_paths p
   where p.locale = ${primary} and p.is_current and p.product_id is not null
     and not exists (
       select 1 from public.url_paths t
        where t.locale = ${locale} and t.product_id = p.product_id and t.is_current)`;

/** Поточні токени модифікацій основної мови без поточного токена в `locale`. */
export const tokenCandidates = (
  primary: SQL | string,
  locale: string,
): SQL => sql`
  select p.modification_id, p.scope_id, p.slug from public.slug_tokens p
   where p.locale = ${primary} and p.is_current and p.token_kind = 'modification'
     and not exists (
       select 1 from public.slug_tokens t
        where t.locale = ${locale} and t.modification_id = p.modification_id
          and t.is_current)`;

/** `FOR KEY SHARE` рядків `table` за id (у порядку id); повертає наявні. */
export async function keyShare(
  db: ActorDb,
  table: 'products' | 'product_modifications',
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const res = await db.execute<{ id: string }>(sql`
    select id from ${sql.raw(`public.${table}`)}
     where id = any(${textArray([...new Set(ids)])}::uuid[])
     order by id
       for key share`);
  return new Set(res.rows.map((r) => r.id));
}
