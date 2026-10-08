/**
 * Читання SQL кроку покупців К3-Е6г (`./admin-customers.mjs`) — «що насправді
 * в базі». Окремим модулем за каноном 150 рядків; записи (засів, прибирання) —
 * `./admin-customers-seed.mjs`, агрегати дашборду й сироти —
 * `./admin-customers-facts.mjs`.
 */
import { sql } from './sql.mjs';

const one = async (...args) => (await sql(...args))[0] ?? null;

/** Користувач за email (без регістру): id, email, бан, підтвердження. */
export const userByEmail = (url, email) =>
  one(
    url,
    `select id, email, name, banned_at, email_verified from public.users
      where lower(email) = lower($1)`,
    [email],
  );

/** Профіль за id користувача: імʼя, email, категорія й блок. */
export const profileOf = (url, userId) =>
  one(
    url,
    `select p.first_name, p.email, p.category_id, p.category_locked,
            c.name as category
       from public.profiles p
       left join public.user_categories c on c.id = p.category_id
      where p.user_id = $1`,
    [userId],
  );

/** Ролі користувача (`user_roles.role`). */
export const rolesOf = async (url, userId) =>
  (
    await sql(url, 'select role from public.user_roles where user_id = $1', [
      userId,
    ])
  ).map((r) => r.role);

export const sessionsCount = async (url, userId) =>
  (
    await one(
      url,
      'select count(*)::int as c from public.sessions where user_id = $1',
      [userId],
    )
  ).c;

/** Історія категорії: хто змінив і яким правилом (від старших до новіших). */
export const historyOf = (url, userId) =>
  sql(
    url,
    `select to_category_name, rule_id, changed_by from public.user_category_history
      where user_id = $1 order by created_at, id`,
    [userId],
  );

/** Замовлення з ПД-колонками, які має стерти видалення (Е6г-7, Е6г-10). */
export const orderRow = (url, orderId) =>
  one(
    url,
    `select user_id, first_name, last_name, email, phone, access_token,
            delivery_address, delivery_city, personal_data_erased_at is not null as erased,
            shipping_data #>> '{destination,kind}' as dest_kind,
            shipping_data #>> '{destination,address}' as dest_address,
            order_number
       from public.orders where id = $1`,
    [orderId],
  );

/** Продукт за slug: id (для відгуку). */
export const productId = async (url, slug) =>
  (await one(url, 'select id from public.products where slug = $1', [slug]))
    ?.id;
