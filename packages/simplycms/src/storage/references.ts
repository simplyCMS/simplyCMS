import { sql } from 'drizzle-orm';
import { STORE_PROFILE_KEY } from 'simplycms/contracts/store-profile';
import type { ActorDb } from 'simplycms/db';
import { LOGO_MEDIA_REFERENCE, MEDIA_COLUMNS } from 'simplycms/domain/media';

/** Де саме файл ще використовується: таблиця, колонка (або шлях у jsonb) і id рядка. */
export interface MediaReference {
  readonly table: string;
  readonly column: string;
  readonly id: string;
}

type Row = { id: string };

/**
 * Усі місця, де референс `key` лежить у даних (Е6д-22): джерело для 409
 * `media_in_use` у `deleteMedia`, для sweep і для інваріанта сідів.
 *
 * 🔴 Ітерує `MEDIA_COLUMNS`, а не перелік таблиць руками: нова медіа-колонка
 * потрапляє сюди сама. Тип колонки — поле `kind` реєстру — для jsonb-масиву
 * членство `col ? key`, для тексту рівність; тест парності звіряє це з
 * `information_schema`, тож колонка нового типу без гілки червонить його.
 *
 * Логотип — окрема гілка: він живе в `system_settings.value->>'logo'`, а не
 * в колонці `MEDIA_COLUMNS`.
 */
export async function findMediaReferences(
  db: ActorDb,
  key: string,
): Promise<MediaReference[]> {
  const found: MediaReference[] = [];
  for (const { table, column, kind } of MEDIA_COLUMNS) {
    const t = sql.identifier(table);
    const c = sql.identifier(column);
    const predicate =
      kind === 'jsonb'
        ? sql`jsonb_typeof(${c}) = 'array' and ${c} ? ${key}`
        : sql`${c} = ${key}`;
    const { rows } = await db.execute<Row>(
      sql`select id::text as id from public.${t} where ${predicate}`,
    );
    for (const row of rows) found.push({ table, column, id: row.id });
  }
  const logo = await db.execute<Row>(
    sql`select id::text as id from public.system_settings
         where key = ${STORE_PROFILE_KEY} and value->>'logo' = ${key}`,
  );
  for (const row of logo.rows)
    found.push({
      table: LOGO_MEDIA_REFERENCE.table,
      column: LOGO_MEDIA_REFERENCE.column,
      id: row.id,
    });
  return found;
}
