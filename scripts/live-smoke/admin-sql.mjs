/**
 * Прямий SQL кроку каталогу адмінки (К3-Е3) — окремим модулем, а не
 * дописане в `./sql.mjs`: спільний файл живе воронкою покупця (Е0) і без
 * розділення переріс би канон 150 рядків. `sql()` — звідти, повторно.
 */
import { sql } from './sql.mjs';

/** Розділ демо-каталогу за slug — крок обирає його у формі товару. */
export async function sectionBySlug(url, slug) {
  const [row] = await sql(
    url,
    `select id, slug, name from public.sections where slug = $1`,
    [slug],
  );
  if (!row) throw new Error(`[live-smoke] у демо-БД немає розділу «${slug}»`);
  return row;
}

/** Товар за slug — доказ, що адмінка й БД бачать той самий id (контракт id). */
export async function productBySlug(url, slug) {
  const [row] = await sql(
    url,
    `select id, is_active from public.products where slug = $1`,
    [slug],
  );
  return row ?? null;
}

/** Скільки товарів має цей slug — 0 після видалення. */
export async function productCountBySlug(url, slug) {
  const [{ n }] = await sql(
    url,
    `select count(*)::int as n from public.products where slug = $1`,
    [slug],
  );
  return n;
}

/** Тип ціни за кодом ('retail' — демо-каталог К2-Е0). */
export async function priceTypeByCode(url, code) {
  const [row] = await sql(
    url,
    `select id from public.price_types where code = $1`,
    [code],
  );
  if (!row) throw new Error(`[live-smoke] у демо-БД немає типу ціни «${code}»`);
  return row;
}

/**
 * Ціна РІВНЯ ТОВАРУ (`modification_id IS NULL` — контракт Е3-14) для пари
 * товар/тип ціни. `null` — рядка немає (поле лишили порожнім).
 */
export async function productPrice(url, productId, priceTypeId) {
  const [row] = await sql(
    url,
    `select price from public.product_prices
      where product_id = $1 and price_type_id = $2 and modification_id is null`,
    [productId, priceTypeId],
  );
  return row ? row.price : null;
}

/**
 * Залишок і статус наявності товару (одна точка видачі в демо) + `images`
 * картки — той самий рядок, куди `saveStock` (Е3-3) пише перерахований статус.
 */
export async function productStockAndImages(url, productId) {
  const [row] = await sql(
    url,
    `select s.quantity, p.stock_status, p.images from public.stock_by_pickup_point s
       join public.products p on p.id = s.product_id
      where s.product_id = $1`,
    [productId],
  );
  return row ?? null;
}
