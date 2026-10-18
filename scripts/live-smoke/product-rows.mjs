/**
 * Масове сівання товарів-фікстур для сценаріїв адмінки (М1, Task 16 фікс-раунд 1): список
 * адмінки читає назву з перекладу ОСНОВНОЇ мови (read-model), тож товар без перекладу в ньому
 * не видно. Одна транзакція під замком `languages-set`: корінь, переклад основної мови й
 * поточна адреса в кожній `draft`/`published` мові — стан, еквівалентний командам агрегата.
 *
 * `М1-TEMP`-дзеркало: колонки `products.slug`/`name` ще NOT NULL (Task 17 їх знесе, і ці два
 * поля зникнуть з ОДНОГО `insert` нижче — більше ніде скрипти їх не пишуть).
 */
import pg from 'pg';
import { PRIMARY_LOCALE } from './product-address.mjs';

/**
 * @param {string} url
 * @param {object} o
 * @param {string} o.prefix префікс slug: `<prefix><i>`
 * @param {string} o.nameSql SQL-вираз назви (змінна ряду — `i`)
 * @param {number} o.count
 * @param {string} o.sectionId
 * @param {string} o.createdSql SQL-вираз `created_at`/`updated_at` (змінна `i`)
 * @param {boolean} [o.hasModifications]
 */
export async function seedProducts(url, o) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock_shared(hashtextextended('languages-set', 0))",
    );
    await client.query(
      `with ins as (
         -- М1-TEMP: зноситься в Task 17 — дзеркала slug/name (і returning/ins.slug нижче).
         insert into public.products (id, slug, name, section_id, has_modifications, created_at, updated_at)
         select gen_random_uuid(), $1 || i, ${o.nameSql}, $2, $4, ${o.createdSql}, ${o.createdSql}
           from generate_series(1, $3::int) i
         returning id, slug, name),
       tr as (
         insert into public.product_translations (product_id, locale, name)
         select id, ${PRIMARY_LOCALE}, name from ins)
       insert into public.url_paths (id, locale, path, product_id, is_current)
       select gen_random_uuid(), l.code, ins.slug, ins.id, true
         from ins cross join public.languages l
        where l.status in ('draft', 'published')`,
      [o.prefix, o.sectionId, o.count, o.hasModifications ?? true],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/** Прибирання: товари за префіксом їхніх адрес (каскад забирає переклади й адреси). */
export const deleteProductsByPrefix = (sql, url, prefix) =>
  sql(
    url,
    `delete from public.products where id in (
       select product_id from public.url_paths where path like $1)`,
    [`${prefix}%`],
  );
