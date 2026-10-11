import { and, eq, sql } from 'drizzle-orm';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import {
  MAX_REVIEW_IMAGES,
  normalizeMediaRefs,
  REVIEW_MEDIA_ENTITY,
} from 'simplycms/domain/media';
import { sanitizeNullableRichHtml } from 'simplycms/sanitize';
import { productReviews } from 'simplycms/schema';
import {
  completeMediaErasures,
  eraseMediaRows,
  withPublishedRollback,
  writeMedia,
  type MediaStorageOptions,
} from 'simplycms/storage';
import { withCustomerDb } from './db';
import type { ReviewImageBytes } from './reviews-write';

/** Вхід правки: `keep` — референси фото, які покупець лишає. */
export interface ReviewEditInput {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  keep: readonly string[];
}

/**
 * Відредагувати власний відгук разом із фото ОДНИМ актом (Е6д-23).
 *
 * 🔴 Правка повертає відгук на модерацію: `status: 'pending'` пишеться явно
 * (політика `product_reviews_update_own` вимагає саме його у WITH CHECK, тож
 * інакше «схвалений» текст обійшов би модерацію), `updated_at` ставить сервер —
 * він і є версією, проти якої модератор схвалює (`setReviewsStatus`).
 *
 * 🔴 `keep` ⊆ поточних `images` ЦЬОГО відгуку (під `FOR UPDATE`): інакше
 * покупець міг би вписати чужий ключ і за нього ж отримати стирання. Кількість
 * перевіряється ДО першого запису. Нові файли — `writeMedia` з власником
 * `review/<id>`; прибрані — `eraseMediaRows` через `operator` (`app_user` не
 * має DELETE на `media`, Е6д-20а), самі файли — ПІСЛЯ COMMIT. Збій
 * транзакції прибирає щойно опубліковане через outbox (Е6д-20б), а старі
 * файли не чіпає. Чужий відгук RLS показує порожнім → `notFound`.
 */
export async function updateProductReviewWithImages(
  userId: string,
  input: ReviewEditInput & { files: readonly ReviewImageBytes[] },
  options: MediaStorageOptions = {},
): Promise<{ id: string }> {
  const keep = [...new Set(input.keep)];
  if (keep.length + input.files.length > MAX_REVIEW_IMAGES)
    throw new Error(REVIEW_SUBMIT_ERROR.tooManyImages);
  const discard = await withPublishedRollback(
    (track) =>
      withCustomerDb(userId, async (db, operator) => {
        const published: string[] = [];
        const [row] = await db
          .select({ images: productReviews.images })
          .from(productReviews)
          .where(
            and(
              eq(productReviews.id, input.id),
              eq(productReviews.userId, userId),
            ),
          )
          .for('update');
        if (!row) throw new Error(REVIEW_SUBMIT_ERROR.notFound);
        const current = normalizeMediaRefs(row.images);
        if (!keep.every((ref) => current.includes(ref)))
          throw new Error(REVIEW_SUBMIT_ERROR.imagesChanged);
        const owner = { entityType: REVIEW_MEDIA_ENTITY, entityId: input.id };
        for (const image of input.files) {
          const meta = { ...image, ...owner, uploadedBy: userId };
          const ref = (await writeMedia(db, meta, options.driver)).ref;
          track(ref);
          published.push(ref);
        }
        await db
          .update(productReviews)
          .set({
            rating: input.rating,
            title: input.title,
            // 🔴 Тема 9, рубіж 1: як при подачі — чистимо ДО запису.
            content: sanitizeNullableRichHtml(input.content, 'review'),
            images: [...keep, ...published],
            status: 'pending',
            updatedAt: sql`now()`,
          })
          .where(eq(productReviews.id, input.id));
        const removed = current.filter((ref) => !keep.includes(ref));
        return operator((tx) => eraseMediaRows(tx, removed, owner));
      }),
    options.discardWith ?? options.driver,
  );
  // Після повернення: після COMMIT опубліковані файли вже референсовані, `catch` їх
  // прибирати не сміє.
  await completeMediaErasures(discard, options.discardWith ?? options.driver);
  return { id: input.id };
}
