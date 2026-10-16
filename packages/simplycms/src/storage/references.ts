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

/**
 * Гілка пошуку референсу — ОДИН опис, з якого будуються ВСІ запити: пошук за
 * одним ключем (`predicate`) і за множиною (`findReferencedKeys`). Окремих
 * предикатів по гілках немає, тож колонка чи логотип не можуть випасти з
 * одного запиту, залишившись в іншому.
 */
interface Branch {
  readonly table: string;
  readonly column: string;
  /** `media.entity_type` файлів, які ця гілка захищає (гейт sweep). */
  readonly entityType: string;
  /** Вираз `id` рядка для таблиці без колонки `id`; за замовчуванням `id`. */
  readonly idExpression: string;
  /** Вираз ключів-посилань рядка: рядок (`text`) або масив рядків (`jsonb`). */
  readonly keysOf: SQL;
  readonly kind: 'text' | 'jsonb';
  /** Додаткова умова на рядок (логотип — лише рядок профілю магазину). */
  readonly rowFilter?: SQL;
}

/**
 * ЄДИНЕ джерело гілок референсу (Е6д-22): `findMediaReferences` і вибір
 * кандидатів sweep (`mediaReferenceExists`) будують запити з цього опису, тож
 * логотип чи нова медіа-колонка не можуть потрапити в одне й випасти з іншого.
 * jsonb → членство `col ? key`, text → рівність; логотип — окрема гілка.
 */
const BRANCHES: readonly Branch[] = [
  ...MEDIA_COLUMNS.map((entry): Branch => ({
    table: entry.table,
    column: entry.column,
    entityType: entry.entityType,
    idExpression: 'idExpression' in entry ? entry.idExpression : 'id',
    keysOf: sql`${sql.identifier(entry.column)}`,
    kind: entry.kind,
  })),
  {
    table: LOGO_MEDIA_REFERENCE.table,
    column: LOGO_MEDIA_REFERENCE.column,
    entityType: LOGO_MEDIA_REFERENCE.entityType,
    idExpression: 'id',
    keysOf: sql`value->>'logo'`,
    kind: 'text',
    rowFilter: sql`key = ${STORE_PROFILE_KEY}`,
  },
];

/** Умова «рядок гілки посилається на `key`» (один ключ). */
function predicate(b: Branch, key: SQL | string): SQL {
  const own =
    b.kind === 'jsonb'
      ? sql`jsonb_typeof(${b.keysOf}) = 'array' and ${b.keysOf} ? ${key}`
      : sql`${b.keysOf} = ${key}`;
  return b.rowFilter ? sql`${b.rowFilter} and ${own}` : own;
}

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
      sql`exists (select 1 from public.${sql.identifier(b.table)} where ${predicate(b, key)})`,
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
      sql`select (${sql.raw(b.idExpression)})::text as id from public.${sql.identifier(b.table)} where ${predicate(b, key)}`,
    );
    for (const row of rows)
      found.push({ table: b.table, column: b.column, id: row.id });
  }
  return found;
}

/** Ключі з `keys`, на які ще є посилання: ОДИН запит на гілку (`= ANY`), не на ключ. */
export async function findReferencedKeys(
  db: ActorDb,
  keys: readonly string[],
): Promise<Set<string>> {
  const live = new Set<string>();
  if (keys.length === 0) return live;
  const arr = sql`array[${sql.join(
    keys.map((k) => sql`${k}`),
    sql`, `,
  )}]::text[]`;
  for (const b of BRANCHES) {
    const table = sql`public.${sql.identifier(b.table)}`;
    const filter = b.rowFilter ? sql`${b.rowFilter} and ` : sql``;
    const query =
      b.kind === 'jsonb'
        ? sql`select e as key from ${table}
               cross join lateral jsonb_array_elements_text(
                 case when jsonb_typeof(${b.keysOf}) = 'array' then ${b.keysOf} else '[]'::jsonb end) e
              where ${filter}jsonb_typeof(${b.keysOf}) = 'array' and ${b.keysOf} ?| ${arr} and e = any(${arr})`
        : sql`select ${b.keysOf} as key from ${table}
               where ${filter}${b.keysOf} = any(${arr})`;
    const { rows } = await db.execute<{ key: string }>(query);
    for (const row of rows) live.add(row.key);
  }
  return live;
}
