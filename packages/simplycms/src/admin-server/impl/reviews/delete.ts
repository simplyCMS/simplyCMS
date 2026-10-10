import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { REVIEW_MEDIA_ENTITY } from 'simplycms/domain/media';
import { productReviews } from 'simplycms/schema';
import { discardMedia, eraseMediaRows } from 'simplycms/storage';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { normalizeImages } from './images';

export const deleteReviewInput = z.object({ id: z.uuid() });

export type DeleteReviewInput = z.output<typeof deleteReviewInput>;

/**
 * Видалення відгуку (`review.moderate`), перша фаза двофазного стирання
 * (Е6д-14): рядок відгуку й рядки `media` його фото йдуть в транзакції
 * викликача, а ключі до стирання файлів повертаються явно.
 *
 * 🔴 Власник (Е6д-16): `{ review, <id> }` — ключ у `images`, якого немає серед
 * `media` цього відгуку (аватар, банер), не стирається й у `discard` не
 * потрапляє. `images` нормалізовано (nullable `jsonb`).
 */
export async function deleteReview(
  db: ActorDb,
  input: DeleteReviewInput,
): Promise<{ discard: string[] }> {
  const [row] = await db
    .delete(productReviews)
    .where(eq(productReviews.id, input.id))
    .returning({ images: productReviews.images });
  if (!row) stateConflict(ADMIN_STATE_CONSTRAINT.reviewNotFound);
  const discard = await eraseMediaRows(db, normalizeImages(row.images), {
    entityType: REVIEW_MEDIA_ENTITY,
    entityId: input.id,
  });
  return { discard };
}

/**
 * Операція: після COMMIT (`runAdmin` повернувся) стирає файли. Збій
 * `discardMedia` ковтається — найгірший наслідок орфан-файл без рядка.
 */
export const deleteReviewOp = async ({
  data,
}: {
  data: z.input<typeof deleteReviewInput>;
}): Promise<void> => {
  const input = parseAdminInput(deleteReviewInput, data);
  const { discard } = await runAdmin('review.moderate', (db) =>
    deleteReview(db, input),
  );
  for (const key of discard) await discardMedia(key);
};
