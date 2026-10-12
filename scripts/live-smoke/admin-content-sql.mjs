/**
 * SQL кроку контенту К3-Е6д (`./admin-content.mjs`) — «що насправді в базі»:
 * банер і його рядки `media`, відгук із фото, засів другого `pending`.
 * Окремим модулем за каноном 150 рядків; прибирання —
 * `./admin-content-cleanup.mjs`.
 */
import { randomUUID } from 'node:crypto';
import { sql } from './sql.mjs';

const one = async (...args) => (await sql(...args))[0] ?? null;

/** Банер за заголовком: id, основна картинка, кнопки. */
export const bannerByTitle = (url, title) =>
  one(
    url,
    `select id, image_url, buttons, placement from public.banners
      where title = $1`,
    [title],
  );

/** Ключі рядків `media`, привʼязаних до сутності (банер чи відгук). */
export const mediaKeysOf = async (url, entityType, entityId) =>
  (
    await sql(
      url,
      `select storage_key from public.media
        where entity_type = $1 and entity_id = $2 order by storage_key`,
      [entityType, entityId],
    )
  ).map((r) => r.storage_key);

/** Скільки рядків `media` з цим ключем (будь-якої сутності). */
export const mediaRowsByKey = async (url, key) =>
  (
    await one(
      url,
      'select count(*)::int as n from public.media where storage_key = $1',
      [key],
    )
  ).n;

/** Відгук за заголовком: id, статус, фото й автор. */
export const reviewByTitle = (url, title) =>
  one(
    url,
    `select id, status, images, user_id from public.product_reviews
      where title = $1`,
    [title],
  );

/** Статуси пачки відгуків: `{ id: status }`. */
export async function reviewStatuses(url, ids) {
  const rows = await sql(
    url,
    'select id, status from public.product_reviews where id = any($1)',
    [ids],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

/**
 * Другий `pending` відгук без автора (`user_id NULL`, як відгук видаленого
 * покупця): масове схвалення має зачепити ДВА рядки, а другий покупець
 * заради цього не потрібен.
 */
export async function seedPendingReview(url, { productId, title, content }) {
  const id = randomUUID();
  await sql(
    url,
    `insert into public.product_reviews
       (id, product_id, user_id, rating, title, content, status)
     values ($1, $2, null, 4, $3, $4, 'pending')`,
    [id, productId, title, content],
  );
  return id;
}

/**
 * Внутрішня примітка адміна (Д-1) — прямим SQL: крок доводить, що вітрина її
 * НЕ віддає, а не те, як її пише картка.
 */
export const setAdminComment = (url, id, note) =>
  sql(
    url,
    'update public.product_reviews set admin_comment = $2 where id = $1',
    [id, note],
  );

/** Чекає рядок до ~10 с: serverFn пише асинхронно до кліку. */
export async function poll(read, ready = (v) => v !== null) {
  let value = null;
  for (let i = 0; i < 40; i += 1) {
    value = await read();
    if (ready(value)) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  return value;
}
