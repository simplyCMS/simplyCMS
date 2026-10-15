/**
 * Р29 на СПРАВЖНЬОМУ збереженому сервері: ціни лише виду глядача в SSR-HTML і
 * `Cache-Control: private, no-store` на персоналізованій сторінці.
 *
 * Чому тут, а не лише харнесом: що serverFn, викликаний під час SSR, кладе
 * заголовок на HTML-відповідь, і що прайс іде в HTML дегідратованим payload-ом
 * лоадера, доводить лише живий запит. Крок створює гуртовий вид, категорію й
 * ціну прямим SQL (id дає викликач — «Категорія A»), переводить покупця
 * воронки в цю категорію й прибирає за собою.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';

const CODE = 'smoke-r29-wholesale';

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {string} p.dbUrl
 * @param {string} p.email покупець воронки (його сесія — у `p.page`)
 * @param {import('@playwright/test').Page} p.page
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runPriceVisibilityChecks({
  base,
  dbUrl,
  email,
  page,
  check,
}) {
  const typeId = randomUUID();
  const categoryId = randomUUID();
  const [product] = await sql(
    dbUrl,
    `select p.id, p.slug, s.slug as section from public.products p
       join public.sections s on s.id = p.section_id
      where p.is_active order by p.slug limit 1`,
  );
  const [profile] = await sql(
    dbUrl,
    `select category_id from public.profiles where email = $1`,
    [email],
  );
  await sql(
    dbUrl,
    `insert into public.price_types (id, name, code, is_default, sort_order)
     values ($1, 'Гурт R29', $2, false, 99)`,
    [typeId, CODE],
  );
  await sql(
    dbUrl,
    `insert into public.user_categories (id, name, code, is_default, price_type_id)
     values ($1, 'Гурт R29', $2, false, $3)`,
    [categoryId, CODE, typeId],
  );
  await sql(
    dbUrl,
    `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
     values ($1, $2, $3, null, 123.45)`,
    [randomUUID(), typeId, product.id],
  );
  await sql(
    dbUrl,
    `update public.profiles set category_id = $1 where email = $2`,
    [categoryId, email],
  );
  try {
    const path = `/catalog/${product.section}/${product.slug}`;
    for (const [label, url] of [
      ['картка', path],
      ['головна', '/'],
    ]) {
      const anon = await fetch(`${base}${url}`);
      const html = await anon.text();
      const cache = anon.headers.get('cache-control') ?? '';
      check(
        `Р29: гість, ${label} — у SSR-HTML немає гуртового виду, без private`,
        anon.status === 200 && !html.includes(typeId) && !/private/.test(cache),
        `${anon.status}, cache-control «${cache || '—'}», вид ${html.includes(typeId) ? 'Є' : 'немає'}`,
      );
    }

    const own = await page.request.get(`${base}${path}`);
    const ownHtml = await own.text();
    const ownCache = own.headers()['cache-control'] ?? '';
    check(
      'Р29: покупець гуртової категорії — його вид у SSR-HTML, private, no-store',
      own.status() === 200 &&
        ownHtml.includes(typeId) &&
        ownCache === 'private, no-store',
      `${own.status()}, cache-control «${ownCache || '—'}», вид ${ownHtml.includes(typeId) ? 'є' : 'НЕМАЄ'}`,
    );
  } finally {
    await sql(
      dbUrl,
      `update public.profiles set category_id = $1 where email = $2`,
      [profile?.category_id ?? null, email],
    );
    await sql(
      dbUrl,
      `delete from public.product_prices where price_type_id = $1`,
      [typeId],
    );
    await sql(dbUrl, `delete from public.user_categories where id = $1`, [
      categoryId,
    ]);
    await sql(dbUrl, `delete from public.price_types where id = $1`, [typeId]);
  }
}
