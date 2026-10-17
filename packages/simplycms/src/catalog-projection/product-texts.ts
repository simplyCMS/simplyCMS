import { sql } from 'drizzle-orm';
import { advisoryXactLockShared, type ActorDb } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  VALUE_COLUMNS,
  columnList,
  col,
  expectedRows,
  type Scope,
} from './expected';

// Запис проєкції тексту товару (І23). Оновлює її ЛИШЕ команда в своїй транзакції
// (`refreshProductTexts`); `languages.fill` лише добудовує відсутні рядки й ніколи
// не перезаписує наявні (`buildMissingProjection`, DO NOTHING).

const ids = (productIds: readonly string[]) => [...new Set(productIds)].sort();

/**
 * Перераховує рядки проєкції товарів `productIds` (для `locales` або всіх мов) з
 * джерела й прибирає зайві: мову, що вийшла з `draft`/`published`, і мову, де
 * товар втратив поточну адресу.
 *
 * 🔴 Сам бере СПІЛЬНИЙ замок `languages-set` і читає набір мов ПІСЛЯ нього: зміна
 * статусу мови ексклюзивна, тож не розминеться з нами; а fill, що бере той самий
 * замок спільно, не перезапише наш рядок (він пише DO NOTHING).
 * Set-based: один `INSERT … SELECT … ORDER BY product_id` — детермінований порядок
 * блокувань рядків між паралельними командами. Незмінений рядок не чіпаємо
 * (`updated_at` лишається).
 */
export async function refreshProductTexts(
  db: ActorDb,
  productIds: readonly string[],
  locales?: readonly string[],
): Promise<void> {
  if (productIds.length === 0 || locales?.length === 0) return;
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const scope: Scope = { productIds: ids(productIds), locales };
  const updates = sql.join(
    VALUE_COLUMNS.map((c) => sql`${col(c)} = excluded.${col(c)}`),
    sql`, `,
  );
  const changed = sql.join(
    VALUE_COLUMNS.map(
      (c) => sql`c.${col(c)} is distinct from excluded.${col(c)}`,
    ),
    sql` or `,
  );
  await db.execute(sql`
    insert into public.catalog_product_texts as c (${columnList()})
    select ${columnList()} from (${expectedRows(scope)}) e
     order by product_id, locale
    on conflict (product_id, locale) do update
       set ${updates}, updated_at = now()
     where ${changed}`);
  const localeFilter = locales
    ? sql` and c.locale in (${sql.join(
        locales.map((l) => sql`${l}`),
        sql`, `,
      )})`
    : sql``;
  await db.execute(sql`
    delete from public.catalog_product_texts c
     where c.product_id in (${sql.join(
       scope.productIds!.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})${localeFilter}
       and not exists (
         select 1 from (${expectedRows(scope)}) e
          where e.product_id = c.product_id and e.locale = c.locale)`);
}

/**
 * Етап проєкції `languages.fill` (і дозбірка при `disabled → published`): будує до
 * `limit` ВІДСУТНІХ рядків мови, наявні не чіпає. 🔴 `DO NOTHING`, не `DO UPDATE`:
 * fill читає знімок, а команда товару, що ще не закомітилась, могла змінити джерело
 * й записати свіжий рядок — перезапис застарілим знімком зламав би І23.
 * Викликач тримає замок `languages-set` (fill — спільний, setStatus — ексклюзивний).
 * 🔴 `FOR KEY SHARE` на товарі: паралельне видалення товару до коміту інакше дало б
 * на вставці FK 23503; видалений рядок після коміту видалення пропускається.
 * Повертає кількість вставлених рядків.
 */
export async function buildMissingProjection(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const res = await db.execute(sql`
    insert into public.catalog_product_texts (${columnList()})
    select ${columnList('e.')} from (${expectedRows({ locales: [locale] })}) e
      join public.products pr on pr.id = e.product_id
     where not exists (
       select 1 from public.catalog_product_texts c
        where c.product_id = e.product_id and c.locale = e.locale)
     order by e.product_id
     limit ${limit}
     for key share of pr
    on conflict (product_id, locale) do nothing`);
  return res.rowCount ?? 0;
}

/** Мова вийшла з `draft`/`published`: її проєкція більше не підтримується (§3.5). */
export async function dropLocaleProjection(
  db: ActorDb,
  locale: string,
): Promise<void> {
  await db.execute(
    sql`delete from public.catalog_product_texts where locale = ${locale}`,
  );
}
