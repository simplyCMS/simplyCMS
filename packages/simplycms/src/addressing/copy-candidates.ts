import { sql, type SQL } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { textArray } from './shared';
import { pathKindOf, raw, tokenKindOf } from './targets';

// Колонки видів і `token_kind` — з реєстру видів цілей; текст запитів не змінюється.
const P = pathKindOf('product');
const T = tokenKindOf('modification');
const pCol = raw(P.column);
const tCol = raw(T.column);
const tKind = raw(`'${T.tokenKind}'`);

// Кандидати й замки пакетного копіювання адрес/токенів у нову мову (`copy.ts`).
// 🔴 Вибір кандидатів — ОДИН фрагмент на етап: з нього беруть і копіювання, і
// перевірка прогресу `languages.fill`, тож «потребує роботи» й «етап зробить» не
// можуть розійтись (інакше fill крутився б на місці).

/** Поточні адреси основної мови товарів, що не мають поточної адреси в `locale`. */
export const pathCandidates = (
  primary: SQL | string,
  locale: string,
): SQL => sql`
  select p.${pCol}, p.path from public.url_paths p
   where p.locale = ${primary} and p.is_current and p.${pCol} is not null
     and not exists (
       select 1 from public.url_paths t
        where t.locale = ${locale} and t.${pCol} = p.${pCol} and t.is_current)`;

/** Поточні токени модифікацій основної мови без поточного токена в `locale`. */
export const tokenCandidates = (
  primary: SQL | string,
  locale: string,
): SQL => sql`
  select p.${tCol}, p.scope_id, p.slug from public.slug_tokens p
   where p.locale = ${primary} and p.is_current and p.token_kind = ${tKind}
     and not exists (
       select 1 from public.slug_tokens t
        where t.locale = ${locale} and t.${tCol} = p.${tCol}
          and t.is_current)`;

/** `FOR KEY SHARE` рядків `table` за id (у порядку id); повертає наявні. */
export async function keyShare(
  db: ActorDb,
  table: string,
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
