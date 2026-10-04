/**
 * SQL кроку редагування позицій К3-Е5б
 * (`./admin-order-edit.mjs`) — окремим модулем за каноном 150 рядків.
 * Гроші порівнюються в цілих центах (Е5б-13): `numeric` приходить рядком,
 * і `parseFloat`-сума дала б float-дрейф там, де БД рахує точно.
 */
import { sql } from './sql.mjs';

/** `"1234.5"` → 123450 без `parseFloat`-дрейфу. */
export function cents(s) {
  const [int, frac = ''] = String(s).split('.');
  return Number(int) * 100 + Number((frac + '00').slice(0, 2));
}

/** Позиції замовлення з цінами й обліком (Е5-4′), у порядку створення. */
export async function orderItems(url, orderId) {
  return sql(
    url,
    `select oi.id, p.slug, oi.name, oi.quantity, oi.price, oi.total,
            oi.stock_reserved, oi.stock_point_id
       from public.order_items oi
       left join public.products p on p.id = oi.product_id
      where oi.order_id = $1 order by oi.created_at, oi.id`,
    [orderId],
  );
}

/** Суми замовлення (рядки `numeric`). */
export async function orderSums(url, orderId) {
  const [row] = await sql(
    url,
    `select subtotal, shipping_cost, total from public.orders where id = $1`,
    [orderId],
  );
  return row ?? null;
}

/**
 * «Суми = формула» (Е5б-8, Е5б-13): `total` позиції = ціна × кількість,
 * `subtotal = Σ total`, `total = subtotal + shipping_cost`. Повертає
 * `{ ok, fact }` — рядок факту для таблиці прогону.
 */
export function sumsFormula(items, sums) {
  const linesOk = items.every(
    (i) => cents(i.total) === cents(i.price) * i.quantity,
  );
  const sub = items.reduce((s, i) => s + cents(i.total), 0);
  const ok =
    linesOk &&
    sub === cents(sums.subtotal) &&
    cents(sums.total) === cents(sums.subtotal) + cents(sums.shipping_cost);
  const fact = `Σ позицій ${sub / 100}, subtotal ${sums.subtotal}, доставка ${sums.shipping_cost}, total ${sums.total}`;
  return { ok, fact };
}

/** `sumsFormula` проти свіжих сум замовлення з БД. */
export async function orderFormula(url, orderId, items) {
  return sumsFormula(items, await orderSums(url, orderId));
}

/** Ціна товару за ДЕФОЛТНИМ типом — покупець без категорії (Е5б-1). */
export async function defaultPrice(url, slug) {
  const [row] = await sql(
    url,
    `select pp.price from public.product_prices pp
       join public.products p on p.id = pp.product_id
       join public.price_types pt on pt.id = pp.price_type_id
      where p.slug = $1 and pt.is_default and pp.modification_id is null`,
    [slug],
  );
  return row?.price ?? null;
}

/** Чекає, доки `pred(items)` справдиться (write-back асинхронний). */
export async function pollItems(url, orderId, pred, timeout = 10_000) {
  const until = Date.now() + timeout;
  let items = await orderItems(url, orderId);
  while (!pred(items) && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 200));
    items = await orderItems(url, orderId);
  }
  return items;
}
