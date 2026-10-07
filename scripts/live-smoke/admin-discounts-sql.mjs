/**
 * SQL кроку знижок і категорій К3-Е6в (`./admin-discounts.mjs`) — окремим
 * модулем за каноном 150 рядків. Тут читання фактів і ДВА записи, яких
 * власник в адмінці не робить сам: фікстура залишку (демо тримає 3 шт
 * товару, а крок оформлює двічі по 3) і повернення покупця в дефолтну
 * категорію перед видаленням тестової (`user_category_has_customers`).
 */
import { sql } from './sql.mjs';

/** Перший рядок запиту або `null`. */
const one = async (...args) => (await sql(...args))[0] ?? null;

/** Групи знижок за назвою: оператор, батько (назвою), активність. */
export async function groupsByName(url, names) {
  return sql(
    url,
    `select g.id, g.name, g.operator, g.is_active, p.name as parent
       from public.discount_groups g
       left join public.discount_groups p on p.id = g.parent_group_id
      where g.name = any($1) order by g.name`,
    [names],
  );
}

/** Знижка за назвою разом із групою, цілями й умовами (як записав `saveDiscount`). */
export async function discountByName(url, name) {
  return one(
    url,
    `select d.id, d.discount_type, d.discount_value::text as value,
            d.price_type_id, g.name as group_name,
            (select json_agg(json_build_object('type', t.target_type, 'id', t.target_id))
               from public.discount_targets t where t.discount_id = d.id) as targets,
            (select json_agg(json_build_object('type', c.condition_type,
                    'op', c.operator, 'value', c.value))
               from public.discount_conditions c where c.discount_id = d.id) as conditions
       from public.discounts d join public.discount_groups g on g.id = d.group_id
      where d.name = $1`,
    [name],
  );
}

/** Категорія покупців за кодом (`null` — немає). */
export async function categoryByCode(url, code) {
  return one(
    url,
    'select id, name, is_default from public.user_categories where code = $1',
    [code],
  );
}

/** Автоправило за назвою з назвами категорій «з → в». */
export async function ruleByName(url, name) {
  return one(
    url,
    `select r.id, r.conditions, f.name as from_name, t.name as to_name
       from public.category_rules r
       left join public.user_categories f on f.id = r.from_category_id
       left join public.user_categories t on t.id = r.to_category_id
      where r.name = $1`,
    [name],
  );
}

/** Профіль покупця за email: id користувача і поточна категорія. */
export async function profileByEmail(url, email) {
  return one(
    url,
    `select p.user_id, p.category_id, p.category_locked, c.name as category
       from public.profiles p
       left join public.user_categories c on c.id = p.category_id
      where p.email = $1`,
    [email],
  );
}

/** Історія категорії покупця — від старших до новіших. */
export async function historyOf(url, userId) {
  return sql(
    url,
    `select from_category_id, to_category_id, from_category_name,
            to_category_name, rule_id, changed_by
       from public.user_category_history where user_id = $1
      order by created_at, id`,
    [userId],
  );
}

/** Позиції замовлення: ціна, база й записане `discount_data`. */
export async function orderItemsPricing(url, orderId) {
  return sql(
    url,
    `select quantity, price::float8 as price, base_price::float8 as base_price,
            discount_data
       from public.order_items where order_id = $1 order by id`,
    [orderId],
  );
}

/** Товар за slug: id і базова ціна дефолтного типу (без модифікації). */
export async function productPricing(url, slug) {
  const [row] = await sql(
    url,
    `select p.id, pp.price::float8 as price from public.products p
       join public.product_prices pp on pp.product_id = p.id
       join public.price_types t on t.id = pp.price_type_id
      where p.slug = $1 and t.is_default and pp.modification_id is null`,
    [slug],
  );
  if (!row) throw new Error(`[live-smoke] у демо-БД немає ціни «${slug}»`);
  return row;
}

/** Фікстура: +`extra` шт на системну точку; повертає вихідний стан рядка. */
export async function bumpStock(url, slug, extra) {
  const [row] = await sql(
    url,
    `update public.stock_by_pickup_point s set quantity = s.quantity + $2
       from public.products p, public.pickup_points pp
      where p.id = s.product_id and pp.id = s.pickup_point_id
        and p.slug = $1 and s.modification_id is null and pp.is_system
      returning s.id, s.quantity - $2 as quantity`,
    [slug, extra],
  );
  if (!row)
    throw new Error(`[live-smoke] немає залишку «${slug}» на системній точці`);
  return { id: row.id, quantity: Number(row.quantity) };
}

/** Прибирання фікстури: кількість рядка — як до кроку; повертає «було → стало». */
export async function restoreStock(url, saved) {
  const row = await one(
    url,
    `with old as (select quantity from public.stock_by_pickup_point where id = $1)
     update public.stock_by_pickup_point set quantity = $2 where id = $1
     returning (select quantity from old) as was, quantity as now`,
    [saved.id, saved.quantity],
  );
  return { was: Number(row?.was), now: Number(row?.now) };
}

/** Прибирання (1): категорія покупця — як після реєстрації, без блоку. */
export async function resetCustomerCategory(url, userId, categoryId) {
  await sql(
    url,
    `update public.profiles set category_id = $2, category_locked = false
      where user_id = $1`,
    [userId, categoryId],
  );
}
