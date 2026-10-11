import { sql, type SQL } from 'drizzle-orm';
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

/** Гілка пошуку референсу: таблиця, колонка/шлях і предикат на вираз ключа. */
interface Branch {
  readonly table: string;
  readonly column: string;
  /** `media.entity_type` файлів, які ця гілка захищає (гейт sweep). */
  readonly entityType: string;
  readonly predicate: (key: SQL | string) => SQL;
}

/**
 * ЄДИНЕ джерело гілок референсу (Е6д-22): `findMediaReferences` і вибір
 * кандидатів sweep (`mediaReferenceExists`) будують предикат тут, тож логотип
 * чи нова медіа-колонка не можуть потрапити в одне й випасти з іншого.
 * jsonb → членство `col ? key`, text → рівність; логотип — окрема гілка.
 */
const BRANCHES: readonly Branch[] = [
  ...MEDIA_COLUMNS.map(({ table, column, kind, entityType }): Branch => {
    const c = sql.identifier(column);
    return {
      table,
      column,
      entityType,
      predicate: (key) =>
        kind === 'jsonb'
          ? sql`jsonb_typeof(${c}) = 'array' and ${c} ? ${key}`
          : sql`${c} = ${key}`,
    };
  }),
  {
    table: LOGO_MEDIA_REFERENCE.table,
    column: LOGO_MEDIA_REFERENCE.column,
    entityType: LOGO_MEDIA_REFERENCE.entityType,
    predicate: (key) =>
      sql`key = ${STORE_PROFILE_KEY} and value->>'logo' = ${key}`,
  },
];

/** Типи власника, для яких реально є гілка пошуку (з тих самих гілок, що SQL). */
export const MEDIA_REFERENCED_ENTITY_TYPES: readonly string[] = [
  ...new Set(BRANCHES.map((b) => b.entityType)),
];

/**
 * SQL-умова «на ключ `key` (вираз, напр. `m.storage_key`) є хоч одне
 * посилання». Для відбору кандидатів sweep прямо в запиті.
 */
export function mediaReferenceExists(key: SQL): SQL {
  const parts = BRANCHES.map(
    (b) =>
      sql`exists (select 1 from public.${sql.identifier(b.table)} where ${b.predicate(key)})`,
  );
  return sql.join(parts, sql` or `);
}

/**
 * Усі місця, де референс `key` лежить у даних (Е6д-22): джерело для
 * страховки sweep і для інваріанта сідів.
 */
export async function findMediaReferences(
  db: ActorDb,
  key: string,
): Promise<MediaReference[]> {
  const found: MediaReference[] = [];
  for (const b of BRANCHES) {
    const { rows } = await db.execute<Row>(
      sql`select id::text as id from public.${sql.identifier(b.table)} where ${b.predicate(key)}`,
    );
    for (const row of rows)
      found.push({ table: b.table, column: b.column, id: row.id });
  }
  return found;
}
