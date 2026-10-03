/**
 * Прямий SQL кроку довідників адмінки (К3-Е4). Окремим модулем поруч із
 * `./admin-sql.mjs` (каталог Е3): разом вони переросли б канон 150 рядків.
 * `sql()` — з `./sql.mjs`, повторно.
 */
import { sql } from './sql.mjs';

/** Усі розділи з цим slug — після дубля має лишитись рівно один. */
export async function sectionsBySlug(url, slug) {
  return sql(
    url,
    `select id, name, is_active, image_url from public.sections where slug = $1`,
    [slug],
  );
}

/** Властивість за slug (slug глобальний — Е4-6). */
export async function propertyBySlug(url, slug) {
  const [row] = await sql(
    url,
    `select id, property_type, has_page, is_filterable, section_id
       from public.section_properties where slug = $1`,
    [slug],
  );
  return row ?? null;
}

/** Опція за slug і власником-властивістю. */
export async function optionBySlug(url, slug) {
  const [row] = await sql(
    url,
    `select id, property_id from public.property_options where slug = $1`,
    [slug],
  );
  return row ?? null;
}

/** Призначення властивостей розділу — для каскаду після видалення розділу. */
export async function assignmentsOfSection(url, sectionId) {
  return sql(
    url,
    `select property_id, applies_to from public.section_property_assignments
      where section_id = $1`,
    [sectionId],
  );
}

/** Скільки типів цін із цим кодом — 0 після видалення, 1 після відмови. */
export async function priceTypeCount(url, code) {
  const [{ n }] = await sql(
    url,
    `select count(*)::int as n from public.price_types where code = $1`,
    [code],
  );
  return n;
}

/**
 * Фікстура кроку: НЕдефолтний тип ціни, яким уже ціновано демо-товар (ціна
 * рівня товару, `modification_id NULL`). Через UI її не поставити без
 * окремого проходу картки товару, а предмет перевірки — саме відмова
 * видалення (Е4-1: RESTRICT → `AdminConflictError('reference')`). id — явні
 * (контракт id Е0: DEFAULT у цих таблицях знято).
 */
export async function seedPricedType(url, { code, name, productSlug }) {
  const [row] = await sql(
    url,
    `with pt as (
       insert into public.price_types (id, name, code, is_default, sort_order)
       values (gen_random_uuid(), $1, $2, false, 90) returning id
     )
     insert into public.product_prices (id, price_type_id, product_id, price)
     select gen_random_uuid(), pt.id, p.id, 999
       from pt, public.products p where p.slug = $3
     returning price_type_id`,
    [name, code, productSlug],
  );
  if (!row)
    throw new Error(`[live-smoke] у демо-БД немає товару «${productSlug}»`);
  return row.price_type_id;
}

/** Скільки цін несе тип — після відмови видалення має лишитись те саме. */
export async function priceCountByType(url, priceTypeId) {
  const [{ n }] = await sql(
    url,
    `select count(*)::int as n from public.product_prices
      where price_type_id = $1`,
    [priceTypeId],
  );
  return n;
}

/** Будь-який активний демо-товар — носій ціни фікстури. */
export async function anyProductSlug(url) {
  const [row] = await sql(
    url,
    `select slug from public.products where is_active order by slug limit 1`,
  );
  if (!row) throw new Error('[live-smoke] у демо-БД немає активних товарів');
  return row.slug;
}
