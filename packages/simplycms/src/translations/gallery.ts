import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { withFallback } from './read';
import { TRANSLATABLE } from './specs';

// Галерея агрегата товару (М1, Task 17): фото — рядки `product_images`, а не jsonb
// `products.images`. ОДИН порядок для вітрини й адмінки (мініатюра списку = перше фото
// картки), тож вираз живе в одному модулі поруч із реєстром перекладної сутності
// `productImage` (`specs.ts`): мовний варіант файлу й alt (`product_image_translations`)
// підключаються тут, а не в кожному читачі (Task 17б).
/** Порядок галереї (аліас `i` — `product_images`): канон для всіх читачів, у т.ч. live-smoke. */
export const GALLERY_ORDER = 'i.sort_order, i.created_at, i.id';
const ORDER = sql.raw(GALLERY_ORDER);

/**
 * Елемент галереї мовою сторінки jsonb-об'єктом `{ key, alt, alt_lang }`:
 * - `key` — перевизначення файлу ЦІЄЇ мови, інакше спільний. Саме не `withFallback`:
 *   перевизначення — заміна для однієї мови, а не текст, що «протікає» в інші; основна
 *   мова (і її власне перевизначення) — це той самий `t_loc`, коли мова сторінки основна;
 * - `alt` — переклад мови, інакше основної (`withFallback`), `null` — жодного;
 * - `alt_lang` — код основної, коли alt узято з неї: ознака з ДАНИХ (`t_loc.alt is null and
 *   t_src.alt is not null`), а не з порівняння текстів (І37).
 * Псевдоніми `t_loc`/`t_src` живуть у власному підзапиті: зовнішній `withFallback`
 * викликача (модифікації) їх не бачить і не перекриває.
 */
function gallerySql(where: SQL, locale: string, primary: string): SQL<unknown> {
  const fb = withFallback(TRANSLATABLE.productImage, locale, primary);
  return sql`coalesce((select jsonb_agg(jsonb_build_object(
        'key', coalesce(t_loc.storage_key, i.storage_key),
        'alt', ${fb.columns.alt},
        'alt_lang', case when ${fb.fallback.alt} then ${primary}::text end
      ) order by ${ORDER})
      from public.product_images i ${fb.joinOn(sql`i.id`)}
     where ${where}), '[]'::jsonb)`;
}

/**
 * Фото товару (без фото модифікацій) мовою `locale` jsonb-масивом у порядку галереї;
 * `'[]'` — без фото. `owner` — вираз id товару в запиті викликача. Декодує `toGallery`
 * (`simplycms/storefront/loaders`).
 */
export const productGallerySql = (
  owner: SQLWrapper,
  locale: string,
  primary: string,
): SQL<unknown> =>
  gallerySql(
    sql`i.product_id = ${owner} and i.modification_id is null`,
    locale,
    primary,
  );

/** Те саме для фото модифікації (`owner` — вираз id модифікації). */
export const modificationGallerySql = (
  owner: SQLWrapper,
  locale: string,
  primary: string,
): SQL<unknown> =>
  gallerySql(sql`i.modification_id = ${owner}`, locale, primary);

/**
 * Головне фото товару — перше в галереї, `null` без фото (мініатюра списку адмінки).
 * Спільний файл без мовних перевизначень: адмінка працює основною мовою (М1).
 */
export const mainImageSql = (owner: SQLWrapper): SQL<string | null> =>
  sql<string | null>`(select i.storage_key from public.product_images i
     where i.product_id = ${owner} and i.modification_id is null
     order by ${ORDER} limit 1)`;
