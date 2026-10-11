/**
 * Публічні файли сіду, які гість мусить бачити (К3-Е6д-5, У2): банер із
 * зображенням у сховищі і фото схваленого відгуку. Демо-банери несуть
 * `data:`-URL, а відгуки сіду — без фото, тож без цього кроку перевірка
 * видимості при роздачі на сідах нічого б не доводила.
 *
 * 🔴 Пише через `writeMedia` з власником (рядок `media` + файл одним актом);
 * фіксовані id і seed PNG — окремого потоку PRNG не займаємо (С-6).
 */
import { eq } from 'drizzle-orm';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import {
  banners,
  productReviews,
} from '../../packages/simplycms/src/schema/index.ts';
import { writeMedia } from '../../packages/simplycms/src/storage/index.ts';
import { pngBytes } from './png.mts';
import type { SeedContext } from './seed-context.mts';

const BANNER_ID = '10000009-0000-4000-8000-0000000005c1';

export async function seedGuestVisibleMedia(
  db: ActorDb,
  ctx: SeedContext,
  reviewId: string,
): Promise<void> {
  const put = (
    entityType: string,
    entityId: string,
    seed: number,
    width: number,
    height: number,
  ) =>
    writeMedia(
      db,
      {
        bytes: pngBytes({ width, height, seed }),
        mime: 'image/png',
        entityType,
        entityId,
        uploadedBy: ctx.ownerId,
      },
      ctx.media,
    );

  const banner = await put('banner', BANNER_ID, 9001, 1200, 400);
  await db.insert(banners).values({
    id: BANNER_ID,
    title: 'Новинки вітрини',
    subtitle: 'Банер із файлом у сховищі',
    imageUrl: banner.ref,
    placement: 'home',
    sortOrder: 1,
  });

  const photo = await put('review', reviewId, 9002, 480, 480);
  await db
    .update(productReviews)
    .set({ images: [photo.ref] })
    .where(eq(productReviews.id, reviewId));
}
