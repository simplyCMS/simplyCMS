/**
 * Прямий SQL живого прогону — єдине джерело «що насправді в базі».
 *
 * Окремим модулем (канон 150 рядків, розкладка як у `scripts/pilot-pack/*`):
 * оркестрація і браузерна воронка звертаються сюди, а не пишуть запити самі.
 * Підключення — адмінське (`PG_HARNESS_URL`, той самий доступ, що й у
 * `pnpm db:demo`), тому преамбула `set local role` тут не потрібна: власник
 * кластера RLS не підпадає (`force row level security` канон не вмикає).
 */
import pg from 'pg';

/** Один запит окремим зʼєднанням: прогін короткий, пул тут зайвий. */
export async function sql(url, text, values = []) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

/**
 * Знімок наявності товару: статус + залишок ПО КОЖНІЙ точці видачі.
 *
 * 🔴 Мапа по точках, а не сума: списання й повернення йдуть в ОДНУ
 * детерміновану точку (Е0-3: `orders.pickup_point_id` → системна → перша
 * активна), і «повернулось як було» — це рівність саме мап, а не сум.
 */
export async function stockSnapshot(url, slug) {
  const [product] = await sql(
    url,
    `select p.id, p.stock_status, s.slug as section
       from public.products p
       join public.sections s on s.id = p.section_id
      where p.slug = $1`,
    [slug],
  );
  if (!product)
    throw new Error(`[live-smoke] у демо-БД немає товару «${slug}»`);
  const rows = await sql(
    url,
    `select pickup_point_id, quantity from public.stock_by_pickup_point
      where product_id = $1 order by pickup_point_id`,
    [product.id],
  );
  const byPoint = Object.fromEntries(
    rows.map((r) => [r.pickup_point_id, Number(r.quantity)]),
  );
  const total = Object.values(byPoint).reduce((sum, q) => sum + q, 0);
  return {
    section: product.section,
    status: product.stock_status,
    byPoint,
    total,
  };
}

/** Скільки рядків у `orders` — до і після оформлення. */
export async function ordersCount(url) {
  const [{ c }] = await sql(
    url,
    'select count(*)::int as c from public.orders',
  );
  return c;
}

/** Код статусу замовлення — доказ, що скасування доїхало до БД. */
export async function orderStatusCode(url, orderId) {
  const [row] = await sql(
    url,
    `select st.code from public.orders o
       join public.order_statuses st on st.id = o.status_id
      where o.id = $1`,
    [orderId],
  );
  return row?.code ?? null;
}

/**
 * Записана сума замовлення — праве плече рівності «показане = записане»
 * (рішення М, п.12): ліве плече читає браузер з `#checkout-total`.
 */
export async function orderTotal(url, orderId) {
  const [row] = await sql(
    url,
    'select total from public.orders where id = $1',
    [orderId],
  );
  return row ? Number(row.total) : null;
}

/** Активні точки видачі демо — форма, від якої залежать автовибір і Е0-3. */
export async function activePickupPoints(url) {
  return sql(
    url,
    `select id, is_system from public.pickup_points
      where is_active order by sort_order, id`,
  );
}

/** id замовлення за номером із `order-success` (К3-Е5, `submitCheckout`). */
export async function orderIdByNumber(url, orderNumber) {
  const [row] = await sql(
    url,
    'select id from public.orders where order_number = $1',
    [orderNumber],
  );
  return row?.id ?? null;
}

/** Рядок замовлення для кроку Е5: статус (код і назва) і записана сума. */
export async function orderState(url, orderId) {
  const [row] = await sql(
    url,
    `select st.code, st.name, o.total from public.orders o
       left join public.order_statuses st on st.id = o.status_id
      where o.id = $1`,
    [orderId],
  );
  return row ? { ...row, total: Number(row.total) } : null;
}

/** Облік по позиціях (Е5-4′): кількість, фактично списане і точка. */
export async function orderItemsStock(url, orderId) {
  return sql(
    url,
    `select quantity, stock_reserved, stock_point_id from public.order_items
      where order_id = $1 order by id`,
    [orderId],
  );
}
