import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import {
  assertMediaRefs,
  eraseReplacedMedia,
  type ResourceMedia,
} from '../../resource-media';

// Медіа-контур зображень товару (М1, Task 12). Файли фото й мовних варіантів
// належать ТОВАРУ (`media.entity_type = 'product'`, `entity_id` = id товару),
// навіть для зображення модифікації; перевірка власника й стирання — наявні
// `assertMediaRefs` / `eraseReplacedMedia` (Е6д-1, «об'єкт → рядок»), для яких
// ключі товару подаються як одна синтетична колонка.

const MEDIA: ResourceMedia = { entityType: 'product', columns: ['keys'] };

/** Усі ключі файлів товару: основні фото й мовні варіанти. */
export async function productKeys(
  db: ActorDb,
  productId: string,
): Promise<string[]> {
  const res = await db.execute<{ key: string }>(sql`
    select storage_key as key from public.product_images where product_id = ${productId}
    union
    select t.storage_key from public.product_image_translations t
      join public.product_images i on i.id = t.image_id
     where i.product_id = ${productId} and t.storage_key is not null`);
  return res.rows.map((r) => r.key);
}

/**
 * Нові ключі команди мають бути завантаженими файлами ЦЬОГО товару, інакше
 * 409 `media_ref_invalid`. Стирання йде за `storage_key`, тож без власника
 * підсунутий чужий ключ після наступної заміни стер би чужий файл.
 */
export async function assertImageKeys(
  db: ActorDb,
  productId: string,
  before: readonly string[],
  wanted: readonly string[],
): Promise<void> {
  await assertMediaRefs(db, MEDIA, [
    { id: productId, next: { keys: wanted }, before: { keys: before } },
  ]);
}

/**
 * Рядки `media` ключів, що зникли з товару, + ключі для стирання файлів ПІСЛЯ
 * коміту (друга фаза Е6д-14). Множина «було мінус стало» — тож ключ, який
 * лишився хоч де-небудь (фото чи перевизначення), не стирається.
 */
export async function eraseGone(
  db: ActorDb,
  productId: string,
  before: readonly string[],
): Promise<string[]> {
  const after = await productKeys(db, productId);
  return eraseReplacedMedia(db, MEDIA, [
    {
      id: productId,
      before: { keys: before },
      after: { keys: after },
    },
  ]);
}
