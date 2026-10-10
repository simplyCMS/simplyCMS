import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { REVIEW_STATUSES } from 'simplycms/contracts';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { productReviews } from 'simplycms/schema';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const setReviewsStatusInput = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((a) => new Set(a).size === a.length),
  status: z.enum(REVIEW_STATUSES),
  adminComment: z.string().trim().max(2000).nullable().optional(),
});

export type SetReviewsStatusInput = z.output<typeof setReviewsStatusInput>;

/**
 * Зміна статусу одного чи багатьох відгуків (Е6д-7, `review.moderate`).
 *
 * Ядро без актора (як `setCustomerBan`): транзакція ВИКЛИКАЧА, вхід уже
 * розібраний; сід кличе його напряму під `withActor(app_admin)`.
 *
 * 🔴 Атомарність: спершу `FOR UPDATE` усіх id у порядку `id` (один порядок
 * локів), далі перевірка кількості — відгук, який видалив інший адмін, дає 409
 * `review_not_found` БЕЗ часткового запису. Будь-який перехід дозволено
 * (`rejected → pending` теж). `admin_comment` пишеться лише коли ключ
 * переданий; порожній після `trim` — `NULL`.
 */
export async function setReviewsStatus(
  db: ActorDb,
  input: SetReviewsStatusInput,
): Promise<{ updated: number }> {
  const locked = await db
    .select({ id: productReviews.id })
    .from(productReviews)
    .where(inArray(productReviews.id, input.ids))
    .orderBy(productReviews.id)
    .for('update');
  if (locked.length < input.ids.length)
    stateConflict(ADMIN_STATE_CONSTRAINT.reviewNotFound);
  const updated = await db
    .update(productReviews)
    .set({
      status: input.status,
      updatedAt: sql`now()`,
      ...(input.adminComment !== undefined
        ? { adminComment: input.adminComment || null }
        : {}),
    })
    .where(inArray(productReviews.id, input.ids))
    .returning({ id: productReviews.id });
  return { updated: updated.length };
}

export const setReviewsStatusOp = async ({
  data,
}: {
  data: z.input<typeof setReviewsStatusInput>;
}): Promise<{ updated: number }> => {
  const input = parseAdminInput(setReviewsStatusInput, data);
  return runAdmin('review.moderate', (db) => setReviewsStatus(db, input));
};
