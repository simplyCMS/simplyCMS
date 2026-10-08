/**
 * Записи SQL кроку покупців К3-Е6г (`./admin-customers.mjs`): тимчасові
 * категорії й автоправило, відгук покупця (форма відгуку не потрібна —
 * доводиться видалення) і прибирання B (`delete from users` з каскадами).
 * Окремо від читань (`./admin-customers-sql.mjs`) за каноном 150 рядків.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';

const one = async (...args) => (await sql(...args))[0] ?? null;

/** Тимчасова пара категорій і автоправило «будь-яка → авто при ≥1 замовленні». */
export async function seedRule(url, fx) {
  const ids = { pin: randomUUID(), auto: randomUUID(), rule: randomUUID() };
  for (const [id, c] of [
    [ids.pin, fx.pin],
    [ids.auto, fx.auto],
  ])
    await sql(
      url,
      'insert into public.user_categories (id, name, code) values ($1, $2, $3)',
      [id, c.name, c.code],
    );
  await sql(
    url,
    `insert into public.category_rules (id, name, to_category_id, conditions)
     values ($1, $2, $3, $4)`,
    [
      ids.rule,
      fx.ruleName,
      ids.auto,
      JSON.stringify({
        type: 'all',
        rules: [{ field: 'orders_count', operator: '>=', value: '1' }],
      }),
    ],
  );
  return ids;
}

/** Схвалений відгук покупця (рейтинг 5) — те, що лишиться після його видалення. */
export async function seedReview(url, { productId, userId, content }) {
  const id = randomUUID();
  await sql(
    url,
    `insert into public.product_reviews (id, product_id, user_id, rating, content, status)
     values ($1, $2, $3, 5, $4, 'approved')`,
    [id, productId, userId, content],
  );
  return id;
}

export const reviewById = (url, id) =>
  one(
    url,
    'select user_id, rating, content from public.product_reviews where id = $1',
    [id],
  );

/** Прибирання: розбанити й видалити користувача каскадом (`delete from users`). */
export async function dropUser(url, userId) {
  await sql(url, 'update public.users set banned_at = null where id = $1', [
    userId,
  ]);
  await sql(url, 'delete from public.users where id = $1', [userId]);
}

/** Прибирання конфігурації: правило, потім категорії (історія переживає — SET NULL). */
export async function dropRule(url, ids) {
  await sql(url, 'delete from public.category_rules where id = any($1)', [
    [ids.rule],
  ]);
  await sql(url, 'delete from public.user_categories where id = any($1)', [
    [ids.pin, ids.auto],
  ]);
}
