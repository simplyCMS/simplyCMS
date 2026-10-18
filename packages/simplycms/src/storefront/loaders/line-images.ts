import { sql } from 'drizzle-orm';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import type { TextLocale } from 'simplycms/domain/translations';
import { lineImageSql } from 'simplycms/translations';
import type { ActorDb } from './db';
import { toGalleryImage } from './entities/gallery';

/** Пара товар/модифікація позиції кошика. */
export interface LineRef {
  productId: string;
  modificationId: string | null;
}

/** Ключ позиції в мапі мініатюр. */
export const lineKey = (l: LineRef): string =>
  `${l.productId}:${l.modificationId ?? ''}`;

/**
 * Мініатюри позицій кошика мовою `text` одним запитом — тим самим читачем галереї, що й
 * сторінка товару (`lineImageSql`): `commerce` (квота, той самий тір, що `translations`)
 * фото не читає, тож його доклеює лоадер вітрини в ТІЙ САМІЙ транзакції квоти.
 */
export async function loadLineImages(
  db: ActorDb,
  lines: readonly LineRef[],
  text: TextLocale,
): Promise<Map<string, ProductImageViewModel | null>> {
  const out = new Map<string, ProductImageViewModel | null>();
  if (lines.length === 0) return out;
  const rows = sql.join(
    lines.map((l) => sql`(${l.productId}::uuid, ${l.modificationId}::uuid)`),
    sql`, `,
  );
  const res = await db.execute<{
    product_id: string;
    modification_id: string | null;
    image: unknown;
  }>(sql`
    select x.product_id, x.modification_id,
           ${lineImageSql(sql`x.product_id`, sql`x.modification_id`, text.locale, text.primary)} as image
      from (values ${rows}) as x(product_id, modification_id)`);
  for (const r of res.rows) {
    // Декодер стоїть у формі виклику за аліасом проєкції — так його бачить гейт `media-read-resolve`.
    const decoded = { image: toGalleryImage(r.image) };
    out.set(
      lineKey({ productId: r.product_id, modificationId: r.modification_id }),
      decoded.image,
    );
  }
  return out;
}
