/**
 * SQL кроку доставки К3-Е6а (`./admin-shipping.mjs`) — окремим модулем за
 * каноном 150 рядків. Тут лише читання фактів і ДВА записи фікстури, яких
 * власник в адмінці не робить сам: рядок залишку товару на новій точці
 * (`reserveStock` на точці без залишку відмовляє, а обрана точка не має
 * fallback) і його прибирання.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';

/** Демо-товар з обліком залишку, на якому крок оформлює обидва замовлення. */
export const SHIPPING_PRODUCT_SLUG = 'sonyachna-panel-550w-mono';

/** Зони за назвою: `{ name, is_default }` — доказ, куди перейшов дефолт. */
export async function zonesByName(url, names) {
  return sql(
    url,
    `select name, is_default from public.shipping_zones
      where name = any($1) order by name`,
    [names],
  );
}

/** Спосіб доставки за кодом (провайдер, режим ціни, активність). */
export async function methodByCode(url, code) {
  const [row] = await sql(
    url,
    `select id, provider, pricing, is_active from public.shipping_methods
      where code = $1`,
    [code],
  );
  return row ?? null;
}

/** Точка видачі за назвою разом зі способом, якому належить. */
export async function pointByName(url, name) {
  const [row] = await sql(
    url,
    `select id, method_id, name, is_active from public.pickup_points
      where name = $1`,
    [name],
  );
  return row ?? null;
}

/** Поточна назва точки за id (`null` — точки вже немає). */
export async function pointNameById(url, id) {
  const [row] = await sql(
    url,
    'select name from public.pickup_points where id = $1',
    [id],
  );
  return row?.name ?? null;
}

/** Тарифи способу: скільки їх і з якою вартістю. */
export async function ratesOf(url, methodId) {
  return sql(
    url,
    `select id, calculation_type, base_cost from public.shipping_rates
      where method_id = $1 order by id`,
    [methodId],
  );
}

/** Кладе на точку рядок залишку товару (кількість `quantity`); id — викликача. */
export async function seedPointStock(url, pointId, slug, quantity) {
  const id = randomUUID();
  await sql(
    url,
    `insert into public.stock_by_pickup_point
       (id, pickup_point_id, product_id, modification_id, quantity)
     select $1, $2, p.id, null, $4 from public.products p where p.slug = $3`,
    [id, pointId, slug, quantity],
  );
  return id;
}

/** Кількість у рядку залишку (`null` — рядка немає). */
export async function stockRowQty(url, id) {
  const [row] = await sql(
    url,
    'select quantity from public.stock_by_pickup_point where id = $1',
    [id],
  );
  return row ? Number(row.quantity) : null;
}

/** Прибирання фікстури (крок 2 `finally`): рядок залишку на тестовій точці. */
export async function deleteStockRow(url, id) {
  await sql(url, 'delete from public.stock_by_pickup_point where id = $1', [
    id,
  ]);
}

/** Доставка замовлення: суми, посилання на спосіб/точку і знімок. */
export async function orderShipping(url, orderId) {
  const [row] = await sql(
    url,
    `select subtotal, shipping_cost, total, shipping_method_id,
            pickup_point_id, shipping_data
       from public.orders where id = $1`,
    [orderId],
  );
  return row ?? null;
}

/** Чекає, доки `read()` дасть значення, що задовольняє `pred` (write-back). */
export async function pollUntil(read, pred, timeout = 10_000) {
  const until = Date.now() + timeout;
  let value = await read();
  while (!pred(value) && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 200));
    value = await read();
  }
  return value;
}
