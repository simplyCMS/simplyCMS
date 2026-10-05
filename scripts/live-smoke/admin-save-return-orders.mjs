/**
 * Збереження в картці замовлення і повернення до `/admin/orders` (симптом
 * TSDB-1, сценарій (в) кроку `./admin-save-return.mjs`): статус змінено в
 * картці → у списку новий бейдж, 50 рядків першої сторінки на місці.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';
import { PAGE, SEEDED, TS, waitRows } from './admin-save-return.mjs';

const orderIds = (page) =>
  page
    .locator('tbody tr a[href*="/admin/orders/"]')
    .evaluateAll((as) =>
      as.map((a) => a.getAttribute('href').split('/').pop()),
    );

export async function runAdminOrderSaveReturnStep({
  context,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const tag = randomUUID().slice(0, 6);
  try {
    // (в) статус замовлення в картці → назад до списку.
    const [st] = await sql(
      dbUrl,
      `select id from public.order_statuses where code = 'new'`,
    );
    const [next] = await sql(
      dbUrl,
      `select id, name from public.order_statuses where code not in ('new', 'cancelled') order by sort_order limit 1`,
    );
    await sql(
      dbUrl,
      `insert into public.orders (id, order_number, first_name, last_name, email, phone, payment_method,
                                  subtotal, total, access_token, status_id, created_at, updated_at)
       select gen_random_uuid(), 'SR-${tag}-' || i, 'Збер', 'Тест', 'sr-${tag}-' || i || '@example.test', '+380000000000',
              'cash', 1, 1, 'sr-${tag}-' || i || '-' || gen_random_uuid(), $1, ${TS}, ${TS}
         from generate_series(1, ${SEEDED}) i`,
      [st.id],
    );
    await page.goto(`${base}/admin/orders`, { waitUntil: 'networkidle' });
    await waitRows(page, PAGE);
    await page
      .locator('tbody tr a', { hasText: `SR-${tag}-1` })
      .first()
      .click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    const orderId = page.url().split('/').pop();
    await page
      .locator('select[aria-label="Статус замовлення"]')
      .selectOption(next.id);
    let status;
    for (let k = 0; k < 40 && status !== next.id; k++) {
      await page.waitForTimeout(250);
      [{ status_id: status }] = await sql(
        dbUrl,
        `select status_id from public.orders where id = $1`,
        [orderId],
      );
    }
    await page.goBack();
    await page.waitForURL(`${base}/admin/orders`);
    await waitRows(page, PAGE);
    // Фіксована пауза свідома: чекаємо на ВІДСУТНЄ усічення списку (регресія — рядки зникають після перезавантаження), події для цього немає.
    await page.waitForTimeout(1000);
    const ids = await orderIds(page);
    const topIds = (
      await sql(
        dbUrl,
        `select id from public.orders order by created_at desc limit ${PAGE}`,
      )
    ).map((r) => r.id);
    const rowText = await page
      .locator('tbody tr', { hasText: `SR-${tag}-1` })
      .first()
      .innerText();
    check(
      'збереження: статус замовлення змінено в картці — у списку новий бейдж, рядки на місці',
      status === next.id &&
        rowText.includes(next.name) &&
        ids.length >= PAGE &&
        new Set(ids).size === ids.length &&
        topIds.every((id) => ids.includes(id)),
      `статус ${status === next.id}, ${ids.length} рядків; «${rowText.replace(/\s+/g, ' ')}»`,
    );
  } finally {
    await sql(
      dbUrl,
      `delete from public.orders where order_number like 'SR-${tag}-%'`,
    ).catch(() => {});
    await page.close().catch(() => {});
  }
}
