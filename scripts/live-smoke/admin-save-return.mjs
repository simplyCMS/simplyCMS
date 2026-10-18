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
import { PRIMARY_LOCALE } from './product-address.mjs';
import {
  deleteProductsByPrefix,
  seedModification,
  seedProducts,
} from './product-rows.mjs';
import { sectionBySlug } from './admin-sql.mjs';
import { expectVisible, waitToast } from './wait.mjs';

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
  const modId = randomUUID();
  try {
    const section = await sectionBySlug(dbUrl, 'sonyachni-paneli');
    await seedProducts(dbUrl, {
      prefix: `sr-${tag}-`,
      nameSql: `'Збер ${tag} ' || lpad(i::text, 3, '0')`,
      count: SEEDED,
      sectionId: section.id,
      createdSql: TS,
    });
    const [product] = await sql(
      dbUrl,
      `select product_id as id from public.product_translations
        where name = $1 and locale = ${PRIMARY_LOCALE}`,
      [old],
    );
    await seedModification(dbUrl, {
      id: modId,
      productId: product.id,
      slug: `sr-mod-${tag}`,
      name: `Мод ${tag}`,
    });

    // (б) залишки модифікації в діалозі картки.
    await page.goto(`${base}/admin/products`, { waitUntil: 'networkidle' });
    await waitRows(page, PAGE);
    await page.getByRole('cell', { name: old, exact: true }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    await page.locator('tr', { hasText: `Мод ${tag}` }).click();
    await page.locator('#stock-quantity').fill('5');
    await page.getByRole('button', { name: 'Зберегти залишки' }).click();
    if (!(await waitToast(page, 'Залишки збережено')))
      throw new Error('[live-smoke] тост «Залишки збережено» не зʼявився');
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
    const badgeShown = await expectVisible(badge, 10_000);
    check(
      'збереження: залишок модифікації 5 → in_stock у SQL і бейдж «В наявності»',
      mod?.quantity === 5 && mod.stock_status === 'in_stock' && badgeShown,
      JSON.stringify(mod),
    );

    // (а) перейменування товару → назад до списку.
    await page.locator('#product-name').fill(renamed);
    await page.getByRole('button', { name: 'Зберегти' }).first().click();
    if (!(await waitToast(page, 'Товар оновлено')))
      throw new Error('[live-smoke] тост «Товар оновлено» не зʼявився');
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
        `select t.name from public.products p
           join public.product_translations t
             on t.product_id = p.id and t.locale = ${PRIMARY_LOCALE}
          order by p.created_at desc limit ${PAGE}`,
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
      `delete from public.stock_by_pickup_point where modification_id = '${modId}'`,
      `delete from public.product_modifications where id = '${modId}'`,
    ])
      await sql(dbUrl, q).catch(() => {});
    await deleteProductsByPrefix(sql, dbUrl, `sr-${tag}-`).catch(() => {});
    await page.close().catch(() => {});
  }
}
