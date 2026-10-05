/**
 * Крок Етапу A «Фундамент даних адмінки» — збереження в картці і ПОВЕРНЕННЯ
 * до списку (симптом TSDB-1: після write-back список губив чужі рядки або
 * показував стару назву). Три сценарії на реальному сервері: (а) перейменування
 * товару → назад у `/admin/products`; (б) залишки МОДИФІКАЦІЇ (`useStock.save`,
 * гілка модифікації) → SQL і бейдж статусу; (в) зміна статусу замовлення —
 * `./admin-save-return-orders.mjs`. Засів — 55 товарів (повна перша сторінка),
 * прибирається у `finally` кожним запитом окремо.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';
import { sectionBySlug } from './admin-sql.mjs';

export const SEEDED = 55;
export const PAGE = 50;
export const TS = `now() + interval '2 hours' + make_interval(secs => 200 - i)`;
export const waitRows = (page, n) =>
  page.waitForFunction(
    (k) => document.querySelectorAll('tbody tr').length >= k,
    n,
    { timeout: 15_000 },
  );
export async function runAdminSaveReturnStep({ context, base, dbUrl, check }) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const tag = randomUUID().slice(0, 6);
  const old = `Збер ${tag} 001`;
  const renamed = `${old} ЗМІНЕНО`;
  try {
    const section = await sectionBySlug(dbUrl, 'sonyachni-paneli');
    await sql(
      dbUrl,
      `insert into public.products (id, slug, name, section_id, created_at, updated_at)
       select gen_random_uuid(), 'sr-${tag}-' || i, 'Збер ${tag} ' || lpad(i::text, 3, '0'), $1, ${TS}, ${TS}
         from generate_series(1, ${SEEDED}) i`,
      [section.id],
    );
    const [product] = await sql(
      dbUrl,
      `select id from public.products where name = $1`,
      [old],
    );
    const modId = randomUUID();
    await sql(
      dbUrl,
      `insert into public.product_modifications (id, product_id, slug, name) values ($1, $2, 'sr-mod-${tag}', 'Мод ${tag}')`,
      [modId, product.id],
    );

    // (б) залишки модифікації в діалозі картки.
    await page.goto(`${base}/admin/products`, { waitUntil: 'networkidle' });
    await waitRows(page, PAGE);
    await page.getByRole('cell', { name: old, exact: true }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    await page.locator('tr', { hasText: `Мод ${tag}` }).click();
    await page.locator('#stock-quantity').fill('5');
    await page.getByRole('button', { name: 'Зберегти залишки' }).click();
    await page.getByText('Залишки збережено').waitFor({ timeout: 10_000 });
    const [mod] = await sql(
      dbUrl,
      `select m.stock_status, s.quantity from public.product_modifications m
         join public.stock_by_pickup_point s on s.modification_id = m.id where m.id = $1`,
      [modId],
    );
    await page.keyboard.press('Escape');
    const badge = page
      .locator('tr', { hasText: `Мод ${tag}` })
      .getByText('В наявності');
    await badge.waitFor({ timeout: 10_000 }).catch(() => {});
    check(
      'збереження: залишок модифікації 5 → in_stock у SQL і бейдж «В наявності»',
      mod?.quantity === 5 &&
        mod.stock_status === 'in_stock' &&
        (await badge.count()) === 1,
      JSON.stringify(mod),
    );

    // (а) перейменування товару → назад до списку.
    await page.locator('#product-name').fill(renamed);
    await page.getByRole('button', { name: 'Зберегти' }).first().click();
    await page.getByText('Товар оновлено').waitFor({ timeout: 10_000 });
    await page.goBack();
    await page.waitForURL(`${base}/admin/products`);
    await waitRows(page, PAGE);
    // Фіксована пауза свідома: чекаємо на ВІДСУТНЄ усічення списку (регресія — рядки зникають після перезавантаження), події для цього немає.
    await page.waitForTimeout(1000);
    const names = await page
      .locator('tbody tr td.font-medium')
      .allTextContents();
    const top = (
      await sql(
        dbUrl,
        `select name from public.products order by created_at desc limit ${PAGE}`,
      )
    ).map((r) => r.name);
    check(
      'збереження: після повернення у список — нова назва, старої немає, рядків не менше за першу сторінку SQL',
      names.includes(renamed) &&
        !names.includes(old) &&
        names.length >= PAGE &&
        new Set(names).size === names.length &&
        top.every((n) => names.includes(n === old ? renamed : n)),
      `${names.length} рядків, унікальних ${new Set(names).size}`,
    );

    check(
      'збереження: адмін pageerror = 0',
      errors.length === 0,
      errors.join(' | '),
    );
  } finally {
    // Послідовно (FK: залишки → модифікація → товар), кожен запит ізольовано.
    for (const q of [
      `delete from public.stock_by_pickup_point where modification_id in (select id from public.product_modifications where slug = 'sr-mod-${tag}')`,
      `delete from public.product_modifications where slug = 'sr-mod-${tag}'`,
      `delete from public.products where slug like 'sr-${tag}-%'`,
    ])
      await sql(dbUrl, q).catch(() => {});
    await page.close().catch(() => {});
  }
}
