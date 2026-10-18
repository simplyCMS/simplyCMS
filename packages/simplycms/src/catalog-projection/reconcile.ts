import { sql } from 'drizzle-orm';
import {
  advisoryXactLock,
  advisoryXactLockShared,
  type ActorDb,
} from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { refreshProductTexts } from './product-texts';
import { VALUE_COLUMNS, col, expectedRows } from './expected';
import {
  keyOf,
  parityMismatches,
  type FindOptions,
  type MismatchKey,
} from './parity';

// Звірка проєкції з джерелом (І23). Одна логіка в двох режимах: read-only підрахунок
// (`localeProjectionMismatches`, для повноти мови) і виправлення (`reconcileProductTexts`).

export type { MismatchKey };

/** Відсутні, застарілі й зайві рядки: повний порівняльний FULL JOIN очікуваного зі збереженим. */
function setMismatchSql(o: FindOptions) {
  const scope = {
    productIds: o.productIds,
    locales: o.locale ? [o.locale] : undefined,
  };
  const row = (alias: string) =>
    sql.join(
      VALUE_COLUMNS.map((c) => sql`${sql.raw(alias)}.${col(c)}`),
      sql`, `,
    );
  const stored = [
    o.productIds
      ? sql`c.product_id in (${sql.join(
          o.productIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`true`,
    o.locale ? sql`c.locale = ${o.locale}` : sql`true`,
  ];
  return sql`
    select coalesce(e.product_id, c.product_id) as product_id,
           coalesce(e.locale, c.locale) as locale
      from (${expectedRows(scope)}) e
      full join (select * from public.catalog_product_texts c
                  where ${sql.join(stored, sql` and `)}) c
        on c.product_id = e.product_id and c.locale = e.locale
     where e.product_id is null or c.product_id is null
        or (${row('e')}) is distinct from (${row('c')})`;
}

async function setMismatches(
  db: ActorDb,
  o: FindOptions,
): Promise<MismatchKey[]> {
  const res = await db.execute<{ product_id: string; locale: string }>(sql`
    ${setMismatchSql(o)}
     order by 1, 2
     ${o.limit === undefined ? sql`` : sql`limit ${o.limit}`}`);
  return res.rows.map((r) => ({ productId: r.product_id, locale: r.locale }));
}

/** Усі розбіжності (без дублів) за обраним зрізом; read-only. */
export async function findProjectionMismatches(
  db: ActorDb,
  o: FindOptions = {},
): Promise<MismatchKey[]> {
  const limit = o.limit ?? Number.POSITIVE_INFINITY;
  const set = await setMismatches(db, {
    ...o,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  const seen = new Set(set.map(keyOf));
  const extra = await parityMismatches(db, o, Math.max(limit - set.length, 0));
  return [...set, ...extra.filter((k) => !seen.has(keyOf(k)))].slice(0, limit);
}

/**
 * Розбіжності проєкції мови з джерелом (відсутні + застарілі + зайві + непаритетні) для повноти
 * мови: `count` — повний лік, `sample` — перші `sampleLimit` ключів (відмова публікації їх
 * називає). Лік відсутніх/застарілих/зайвих — агрегатом у SQL: щойно додана мова на 10k товарів
 * не має тягнути 10k ключів у Node на кожну спробу публікації. Непаритетні (доменне правило в TS)
 * сканує `parityMismatches` сторінками й тримає лише самі розбіжності; дублі з першим класом
 * віднімаються точково. Набір мов читається під спільним замком.
 */
export async function localeProjectionMismatches(
  db: ActorDb,
  locale: string,
  sampleLimit: number,
): Promise<{ count: number; sample: MismatchKey[] }> {
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const counted = await db.execute<{ n: string }>(
    sql`select count(*) as n from (${setMismatchSql({ locale })}) m`,
  );
  const parity = await parityMismatches(
    db,
    { locale },
    Number.POSITIVE_INFINITY,
  );
  const both =
    parity.length === 0
      ? []
      : await setMismatches(db, {
          locale,
          productIds: [...new Set(parity.map((k) => k.productId))],
        });
  const seen = new Set(both.map(keyOf));
  const extra = parity.filter((k) => !seen.has(keyOf(k)));
  const head = await setMismatches(db, { locale, limit: sampleLimit });
  return {
    count: Number(counted.rows[0]?.n ?? 0) + extra.length,
    sample: [...head, ...extra].slice(0, sampleLimit),
  };
}

/**
 * Звіряє проєкцію з джерелом і виправляє розбіжності (до `limit` рядків за виклик):
 * `mismatched` — знайдено, `fixed` — після перерахунку збіглося. Різниця — те, що
 * refresh виправити не може (rich-текст без вмісту, вставлений в обхід команди):
 * його треба виправити в джерелі, тому воно лишається видимим.
 *
 * 🔴 ЕКСКЛЮЗИВНИЙ `languages-set`: команда пише проєкцію лише під спільним замком,
 * тож звірка чекає коміту кожної команди, що вже пише проєкцію, а наступні чекають
 * звірку — застарілий знімок не перекриє свіжого рядка (І23). Рядкових замків
 * коренів звірка не бере: лише `FOR KEY SHARE` товарів (за id) — видалений
 * паралельно товар пропускається замість FK 23503 на вставці.
 */
export async function reconcileProductTexts(
  db: ActorDb,
  { limit }: { limit: number },
): Promise<{ mismatched: number; fixed: number }> {
  await advisoryXactLock(db, LOCK_KEYS.languagesSet);
  const found = await findProjectionMismatches(db, { limit });
  if (found.length === 0) return { mismatched: 0, fixed: 0 };
  const ids = [...new Set(found.map((k) => k.productId))].sort();
  const alive = await db.execute<{ id: string }>(sql`
    select id from public.products
     where id in (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})
     order by id
       for key share`);
  const products = alive.rows.map((r) => r.id);
  if (products.length === 0) return { mismatched: found.length, fixed: 0 };
  await refreshProductTexts(db, products);
  const still = new Set(
    (await findProjectionMismatches(db, { productIds: products })).map(keyOf),
  );
  return {
    mismatched: found.length,
    fixed: found.filter((k) => !still.has(keyOf(k))).length,
  };
}
