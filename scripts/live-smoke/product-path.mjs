/**
 * Адреса товару на СПРАВЖНЬОМУ збереженому сервері (М1, Task 15): сторінка
 * `/<path>` з реєстру `url_paths`, ОДИН 301 на історичну адресу / префікс основної
 * мови / закодований параметр, 404 для невідомого.
 *
 * Чому тут, а не юнітом: склейку нормалізації (до Start), splat-роуту сутності і
 * SSR-`head()` разом доводить лише живий сервер. Товару зі старою адресою в сіді
 * немає, тож крок створює його прямим SQL (id дає викликач — «Категорія A») під
 * замком `languages-set` (як демо-сід) і прибирає за собою.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { sql } from './sql.mjs';

const SLUG = 'smoke-address-product';
const OLD_SLUG = 'smoke-address-product-old';

/** GET без слідування редиректу: статус, `Location`, тіло. */
async function probe(base, path) {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location'),
    html: res.status === 200 ? await res.text() : '',
  };
}

const canonicalOf = (html) =>
  /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(html)?.[1] ??
  /<link[^>]*href="([^"]*)"[^>]*rel="canonical"/.exec(html)?.[1] ??
  null;

/** Товар: корінь, переклад і поточна адреса основної мови, історична адреса, проєкція. */
async function insertProduct(dbUrl, id) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock_shared(hashtextextended('languages-set', 0))",
    );
    await client.query(
      `insert into public.products (id, is_active) values ($1, true)`,
      [id],
    );
    await client.query(
      `insert into public.product_translations (product_id, locale, name)
       select $1, code, 'Smoke адреса' from public.languages where is_default`,
      [id],
    );
    // Поточна адреса — у КОЖНІЙ мові draft/published (тригер наявності, І16), історична —
    // лише основною мовою (її 301 і перевіряє крок).
    await client.query(
      `insert into public.url_paths (id, locale, path, product_id, is_current)
       select gen_random_uuid(), code, $2, $1, true from public.languages
        where status in ('draft', 'published')`,
      [id, SLUG],
    );
    await client.query(
      `insert into public.url_paths (id, locale, path, product_id, is_current)
       select gen_random_uuid(), code, $2, $1, false from public.languages where is_default`,
      [id, OLD_SLUG],
    );
    await client.query(
      `insert into public.catalog_product_texts (product_id, locale, name, path, is_translated)
       select $1, code, 'Smoke адреса', $2, true from public.languages where is_default`,
      [id, SLUG],
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
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {string} p.dbUrl
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runProductPathChecks({ base, dbUrl, check }) {
  const id = randomUUID();
  await sql(
    dbUrl,
    `delete from public.products where id in (
       select product_id from public.url_paths where path = $1)`,
    [SLUG],
  );
  await insertProduct(dbUrl, id);
  try {
    // (а) поточна адреса: 200, self-canonical.
    const current = await probe(base, `/${SLUG}`);
    check(
      'адреса: /<path> товару → 200',
      current.status === 200,
      `${current.status}`,
    );
    check(
      'адреса: self-canonical від реєстру',
      canonicalOf(current.html) === `${base}/${SLUG}`,
      canonicalOf(current.html) ?? '—',
    );

    // (б) історична адреса + utm → ОДИН 301 на поточну зі збереженим query.
    const old = await probe(base, `/${OLD_SLUG}?utm_source=smoke`);
    check(
      'адреса: історична → один 301 на поточну з query',
      old.status === 301 && old.location === `/${SLUG}?utm_source=smoke`,
      `${old.status} ${old.location ?? '—'}`,
    );

    // (в) префікс основної мови і закодований параметр — теж один 301 на кінцеву.
    const prefixed = await probe(base, `/uk/${OLD_SLUG}/?utm=%31`);
    check(
      'адреса: /uk/<стара>/?utm=%31 → один 301 на /<поточна>?utm=1',
      prefixed.status === 301 && prefixed.location === `/${SLUG}?utm=1`,
      `${prefixed.status} ${prefixed.location ?? '—'}`,
    );
    const landed = await probe(base, prefixed.location ?? '/');
    check(
      'адреса: кінцева адреса одразу 200 (без другого редіректу)',
      landed.status === 200,
      `${landed.status}`,
    );

    // (г) невідомий шлях, шлях з кількох сегментів і зник­лий розділ-товар: 404.
    const unknown = await probe(base, '/smoke-no-such-product');
    const nested = await probe(base, `/catalog/all/${SLUG}`);
    check(
      'адреса: невідомий шлях і колишній /catalog/…/<товар> → 404',
      unknown.status === 404 && nested.status === 404,
      `${unknown.status} ${nested.status}`,
    );
  } finally {
    await sql(dbUrl, `delete from public.products where id = $1`, [id]);
  }
  // Видалений товар не лишає історії: стара адреса тепер просто 404.
  const gone = await probe(base, `/${OLD_SLUG}`);
  check(
    'адреса: після видалення товару історична адреса → 404',
    gone.status === 404,
    `${gone.status}`,
  );
}
