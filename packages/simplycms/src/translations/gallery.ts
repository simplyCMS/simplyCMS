import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

// Галерея агрегата товару (М1, Task 17): фото — рядки `product_images`, а не jsonb
// `products.images`. ОДИН порядок для вітрини й адмінки (мініатюра списку = перше фото
// картки), тож вираз живе в одному модулі поруч із реєстром перекладної сутності
// `productImage` (`specs.ts`): мовний варіант файлу (`product_image_translations`)
// підключається тут, а не в кожному читачі.
const ORDER = sql.raw('i.sort_order, i.created_at, i.id');

/**
 * Референси фото товару (без фото модифікацій) jsonb-масивом у порядку галереї;
 * `'[]'` — без фото. `owner` — вираз id товару в запиті викликача.
 */
export const productGallerySql = (owner: SQLWrapper): SQL<unknown> =>
  sql`coalesce((select jsonb_agg(i.storage_key order by ${ORDER})
      from public.product_images i
     where i.product_id = ${owner} and i.modification_id is null), '[]'::jsonb)`;

/** Те саме для фото модифікації (`owner` — вираз id модифікації). */
export const modificationGallerySql = (owner: SQLWrapper): SQL<unknown> =>
  sql`coalesce((select jsonb_agg(i.storage_key order by ${ORDER})
      from public.product_images i where i.modification_id = ${owner}), '[]'::jsonb)`;

/** Головне фото товару — перше в галереї, `null` без фото (мініатюра списку адмінки). */
export const mainImageSql = (owner: SQLWrapper): SQL<string | null> =>
  sql<string | null>`(select i.storage_key from public.product_images i
     where i.product_id = ${owner} and i.modification_id is null
     order by ${ORDER} limit 1)`;
