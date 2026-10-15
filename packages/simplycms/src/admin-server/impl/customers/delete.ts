import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  customerCategoryLock,
  eraseOrderPersonalData,
} from 'simplycms/commerce';
import {
  ADMIN_STATE_CONSTRAINT,
  stateConflict,
} from 'simplycms/contracts/domain-errors';
import { advisoryXactLock, type ActorDb } from 'simplycms/db';
import {
  normalizeMediaRefs,
  REVIEW_MEDIA_ENTITY,
} from 'simplycms/domain/media';
import { productReviews, profiles, users } from 'simplycms/schema';
import { completeMediaErasures, eraseMediaRows } from 'simplycms/storage';
import type { CoreActor } from 'simplycms/auth';
import { actorOfGrant } from '../core-actor';
import { runAdmin } from '../run';
import { fieldIssue, parseAdminInput } from '../validation';
import { isAdminUser } from './guards';
import { revokeUserVerifications } from './verifications';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';

export const deleteCustomerInput = z.object({
  userId: z.uuid(),
  confirmEmail: z.string().trim(),
});

export type DeleteCustomerInput = z.output<typeof deleteCustomerInput>;

/**
 * Видалення акаунта покупця зі знеособленням замовлень (Е6г-15),
 * `customer.delete`. ОДНА транзакція (`runAdmin`, не `runAdminTransactions`),
 * порядок жорсткий:
 *
 *  1. `customer-category:<id>` → `admin-roles` (канон §13): перший не дає
 *     правилу категорій писати профіль, що зникає, другий серіалізує з видачею
 *     ролі. Усі захисні перевірки — лише під ними.
 *  2. `users`/`profiles` `FOR UPDATE`, перевірки: існує, не я, не адмін,
 *     `confirmEmail` збігається з email (без регістру).
 *  3. Ref аватара читається ДО знеособлення (профіль зникне каскадом).
 *  4. Знеособлення замовлень → відгуки анонімні й без фото (рейтинг
 *     лишається; `images` взято `FOR UPDATE` до запису) → відкликання
 *     токенів → `DELETE users` (каскад решти графа).
 *  5. ОСТАННІМ — перша фаза двофазного стирання (Е6д-14, переписує Е6г-15):
 *     рядки `media` аватара й фото відгуків, кожен виклик за своїм власником
 *     (Е6д-16: чужий ключ, підсунутий у `images`, не стирається). Ключі
 *     повертаються в `discard`; файли стирає операція ПІСЛЯ COMMIT. Відмова
 *     транзакції файлів не чіпає; збій диска лишає лише орфан-файл без рядка.
 *     Окремої транзакції для аватара немає: інакше роль, видана між
 *     перевіркою й стиранням, стерла б аватар нового адміна.
 *
 * Ядро (С-2, С-15): транзакція ВИКЛИКАЧА, вхід уже розібраний. Перевірка
 * «не я» — лише для `admin`; `system` (сід) її не має, решта перевірок,
 * зокрема «не адмін», діють так само.
 */
export async function deleteCustomer(
  db: ActorDb,
  input: DeleteCustomerInput,
  actor: CoreActor,
): Promise<DeleteCustomerResult & { discard: string[] }> {
  await advisoryXactLock(db, customerCategoryLock(input.userId));
  await advisoryXactLock(db, LOCK_KEYS.adminRoles);
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .for('update');
  if (!user) stateConflict(ADMIN_STATE_CONSTRAINT.customerNotFound);
  const [profile] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.userId, input.userId))
    .for('update');
  if (actor.kind === 'admin' && input.userId === actor.userId)
    stateConflict(ADMIN_STATE_CONSTRAINT.customerSelf);
  if (await isAdminUser(db, input.userId))
    stateConflict(ADMIN_STATE_CONSTRAINT.customerIsAdmin);
  if (input.confirmEmail.toLowerCase() !== user.email.toLowerCase())
    fieldIssue(['confirmEmail'], 'invalid_value');

  const avatarRef = profile?.avatarUrl ?? null;
  const erasedOrders = await eraseOrderPersonalData(
    db,
    input.userId,
    new Date(),
  );
  const reviews = await db
    .select({ id: productReviews.id, images: productReviews.images })
    .from(productReviews)
    .where(eq(productReviews.userId, input.userId))
    .orderBy(productReviews.id)
    .for('update');
  const anonymized = await db
    .update(productReviews)
    .set({ userId: null, images: sql`'[]'::jsonb` })
    .where(eq(productReviews.userId, input.userId))
    .returning({ id: productReviews.id });
  await revokeUserVerifications(db, {
    userId: input.userId,
    email: user.email,
  });
  await db.delete(users).where(eq(users.id, input.userId));
  const discard = avatarRef
    ? await eraseMediaRows(db, [avatarRef], {
        entityType: 'avatar',
        entityId: input.userId,
      })
    : [];
  for (const review of reviews) {
    discard.push(
      ...(await eraseMediaRows(db, normalizeMediaRefs(review.images), {
        entityType: REVIEW_MEDIA_ENTITY,
        entityId: review.id,
      })),
    );
  }
  return { erasedOrders, anonymizedReviews: anonymized.length, discard };
}

export type DeleteCustomerResult = {
  erasedOrders: number;
  anonymizedReviews: number;
};

/**
 * Операція: розбір входу ДО гранта, далі ядро з актором сесії; файли —
 * ПІСЛЯ COMMIT (`runAdmin` повернувся). Збій диска лишає рядок outbox.
 */
export const deleteCustomerOp = async ({
  data,
}: {
  data: z.input<typeof deleteCustomerInput>;
}): Promise<DeleteCustomerResult> => {
  const input = parseAdminInput(deleteCustomerInput, data);
  const { discard, ...result } = await runAdmin(
    'customer.delete',
    (db, grant) => deleteCustomer(db, input, actorOfGrant(grant)),
  );
  await completeMediaErasures(discard);
  return result;
};
