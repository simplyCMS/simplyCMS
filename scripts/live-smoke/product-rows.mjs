/**
 * Масове сівання товарів-фікстур для сценаріїв адмінки (М1, Task 16 фікс-раунд 1): список
 * адмінки читає назву з перекладу ОСНОВНОЇ мови (read-model), тож товар без перекладу в ньому
 * не видно. Одна транзакція під замком `languages-set`: корінь, переклад основної мови й
 * поточна адреса в кожній `draft`/`published` мові — стан, еквівалентний командам агрегата.
 * Інакше коміт відхилять відкладені тригери джерела (І4) і наявності адреси (І16).
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
      `with v as (
         select gen_random_uuid() as id, $1 || i as slug, ${o.nameSql} as name,
                ${o.createdSql} as created
           from generate_series(1, $3::int) i),
       ins as (
         insert into public.products (id, section_id, has_modifications, created_at, updated_at)
         select id, $2, $4, created, created from v),
       tr as (
         insert into public.product_translations (product_id, locale, name)
         select id, ${PRIMARY_LOCALE}, name from v)
       insert into public.url_paths (id, locale, path, product_id, is_current)
       select gen_random_uuid(), l.code, v.slug, v.id, true
         from v cross join public.languages l
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

/**
 * Модифікація існуючого товару: корінь, назва основною мовою й поточний токен у кожній
 * `draft`/`published` мові — однією транзакцією під замком `languages-set` (тригери
 * джерела І4 і наявності токена І16 перевіряють їх на COMMIT).
 */
export async function seedModification(url, { id, productId, slug, name }) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock_shared(hashtextextended('languages-set', 0))",
    );
    await client.query(
      `insert into public.product_modifications (id, product_id) values ($1, $2)`,
      [id, productId],
    );
    await client.query(
      `insert into public.product_modification_translations (product_id, modification_id, locale, name)
       values ($2, $1, ${PRIMARY_LOCALE}, $3)`,
      [id, productId, name],
    );
    await client.query(
      `insert into public.slug_tokens (id, locale, scope_id, slug, modification_id, is_current)
       select gen_random_uuid(), l.code, $2, $3, $1, true
         from public.languages l where l.status in ('draft', 'published')`,
      [id, productId, slug],
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
