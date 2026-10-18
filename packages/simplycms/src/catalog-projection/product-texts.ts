import { sql, type SQL } from 'drizzle-orm';
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
 * статусу мови, звірка й виклик `languages.fill`, що будує проєкцію, беруть його
 * ЕКСКЛЮЗИВНО, тож чекають коміту нашої команди й не розминуться з нами (виклик fill,
 * що копіює адреси, бере спільний, але проєкції не будує).
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
 * Відсутні рядки проєкції мови: очікувані (`expectedRows`), яких ще немає. ЄДИНИЙ
 * предикат «товару бракує рядка, і його можна побудувати» — з нього беруть і етап
 * побудови, і перевірка прогресу `languages.fill`/`setStatus`: товар, для якого рядок
 * побудувати неможливо (немає джерела з назвою чи адреси), не вважається незробленим.
 */
export const missingProjectionRows = (locale: string): SQL => sql`
  select e.* from (${expectedRows({ locales: [locale] })}) e
   where not exists (
     select 1 from public.catalog_product_texts c
      where c.product_id = e.product_id and c.locale = e.locale)`;

/**
 * Етап проєкції `languages.fill` (і дозбірка при `disabled → published`): будує до
 * `limit` ВІДСУТНІХ рядків мови, наявні не чіпає. 🔴 Викликач тримає ЕКСКЛЮЗИВНИЙ
 * `languages-set` (виклик проєкції `languages.fill`, `setStatus`), узятий першим: кожна
 * команда товару пише проєкцію під спільним set до свого коміту, тож етап читає вже
 * закомічене джерело (І23). `DO NOTHING`, не `DO UPDATE`: наявний рядок — завжди від
 * команди чи попереднього етапу з того самого закоміченого джерела, перезаписувати його нема чим.
 * 🔴 `FOR KEY SHARE` на товарі (у порядку id): паралельне видалення товару до коміту
 * інакше дало б на вставці FK 23503; видалений рядок після коміту видалення
 * пропускається. Сильніших замків на товарі тут немає: KEY SHARE сумісний із
 * командами (`NO KEY UPDATE`) і каскадом `SET NULL` розділу.
 * Повертає кількість вставлених рядків.
 */
export async function buildMissingProjection(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const res = await db.execute(sql`
    insert into public.catalog_product_texts (${columnList()})
    select ${columnList('e.')} from (${missingProjectionRows(locale)}) e
      join public.products pr on pr.id = e.product_id
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
