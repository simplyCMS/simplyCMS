import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import {
  normalizeMediaRefs,
  REVIEW_MEDIA_ENTITY,
} from 'simplycms/domain/media';
import { productReviews } from 'simplycms/schema';
import { completeMediaErasures, eraseMediaRows } from 'simplycms/storage';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

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
  const discard = await eraseMediaRows(db, normalizeMediaRefs(row.images), {
    entityType: REVIEW_MEDIA_ENTITY,
    entityId: input.id,
  });
  return { discard };
}

/**
 * Операція: після COMMIT (`runAdmin` повернувся) стирає файли. Збій
 * диска лишає рядок outbox `media_erasures`, `completeMediaErasures` не кидає.
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
  await completeMediaErasures(discard);
};
