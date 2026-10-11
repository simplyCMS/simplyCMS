import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { REVIEW_STATUSES } from 'simplycms/contracts';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { productReviews } from 'simplycms/schema';
import { isoVersion } from '../sql-timestamps';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const setReviewsStatusInput = z.object({
  // Е6д-23: модератор схвалює ПОБАЧЕНУ версію — `updatedAt` з картки/списку
  // (ISO з мілісекундами), а не «що там зараз у БД».
  items: z
    .array(z.object({ id: z.uuid(), updatedAt: z.iso.datetime() }))
    .min(1)
    .max(100)
    .refine((a) => new Set(a.map((i) => i.id)).size === a.length),
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
 * `review_not_found` БЕЗ часткового запису. Далі під тим самим локом версія
 * кожного рядка звіряється з `updatedAt`, яку бачив модератор (Е6д-23): хоч
 * одна розбіжність (покупець відредагував) — 409 `review_changed` на весь
 * пакет. Будь-який перехід дозволено
 * (`rejected → pending` теж). `admin_comment` пишеться лише коли ключ
 * переданий; порожній після `trim` — `NULL`.
 */
export async function setReviewsStatus(
  db: ActorDb,
  input: SetReviewsStatusInput,
): Promise<{ updated: number }> {
  const ids = input.items.map((i) => i.id);
  const locked = await db
    .select({
      id: productReviews.id,
      // Мілісекунди, як `isoTs` у картці/списку: БД тримає мікросекунди, а
      // модератор бачить лише `.SSS`; порівняння сирим значенням давало б
      // хибний 409 на кожному рядку з `now()`.
      version: sql<string>`${isoVersion(sql`${productReviews.updatedAt}`)}`,
    })
    .from(productReviews)
    .where(inArray(productReviews.id, ids))
    .orderBy(productReviews.id)
    .for('update');
  if (locked.length < ids.length)
    stateConflict(ADMIN_STATE_CONSTRAINT.reviewNotFound);
  // Під локом: правка покупця не може вклинитись між перевіркою і UPDATE.
  const seen = new Map(input.items.map((i) => [i.id, i.updatedAt]));
  if (
    locked.some(
      (row) =>
        new Date(seen.get(row.id)!).getTime() !==
        new Date(row.version).getTime(),
    )
  )
    stateConflict(ADMIN_STATE_CONSTRAINT.reviewChanged);
  const updated = await db
    .update(productReviews)
    .set({
      status: input.status,
      updatedAt: sql`now()`,
      ...(input.adminComment !== undefined
        ? { adminComment: input.adminComment || null }
        : {}),
    })
    .where(inArray(productReviews.id, ids))
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
