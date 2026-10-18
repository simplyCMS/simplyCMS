import { sql } from 'drizzle-orm';
import {
  TRANSLATABLE,
  modificationGallerySql,
  withFallback,
} from 'simplycms/translations';
import type { ActorDb } from './db';
import {
  toModificationRow,
  type ModificationRow,
} from './entities/modification';

type RawModification = Parameters<typeof toModificationRow>[0] & {
  name_fallback: boolean;
};

/**
 * Модифікації товару для картки у мові запиту: назва — `withFallback` (мова,
 * інакше основна), токен `?mod=` — поточний токен мови з `slug_tokens`, а за його
 * відсутності токен основної (мова `draft` без звірки). Порядок — `sort_order`.
 * Фото — та сама галерея мови, що й у товару (`modificationGallerySql`, Task 17б).
 */
export async function loadProductModifications(
  db: ActorDb,
  productId: string,
  locale: string,
  primary: string,
): Promise<ModificationRow[]> {
  const fb = withFallback(TRANSLATABLE.productModification, locale, primary);
  const res = await db.execute<RawModification>(sql`
    select m.id, m.product_id, coalesce(tk.slug, tp.slug) as slug,
           ${fb.columns.name} as name, ${fb.fallback.name} as name_fallback, m.sku, m.is_default, m.sort_order,
           m.stock_status, ${modificationGallerySql(sql`m.id`, locale, primary)} as images
      from public.product_modifications m ${fb.joinOn(sql`m.id`)}
      left join public.slug_tokens tk
        on tk.modification_id = m.id and tk.locale = ${locale} and tk.is_current
      left join public.slug_tokens tp
        on tp.modification_id = m.id and tp.locale = ${primary} and tp.is_current
     where m.product_id = ${productId}::uuid
     order by m.sort_order, m.id`);
  return res.rows.map(({ name_fallback, ...row }) => ({
    ...toModificationRow(row),
    // Ознака з даних (`withFallback`), не порівняння текстів: назва, буквально
    // рівна основній, але перекладена, `lang` не отримує.
    name_lang: name_fallback ? primary : null,
  }));
}
