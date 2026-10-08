import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_ROLES_LOCK } from 'simplycms/auth';
import {
  customerCategoryLock,
  eraseOrderPersonalData,
} from 'simplycms/commerce';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { advisoryXactLock } from 'simplycms/db';
import { productReviews, profiles, users } from 'simplycms/schema';
import { eraseMedia } from 'simplycms/storage';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { fieldIssue, parseAdminInput } from '../validation';
import { isAdminUser } from './guards';
import { revokeUserVerifications } from './verifications';

export const deleteCustomerInput = z.object({
  userId: z.uuid(),
  confirmEmail: z.string().trim(),
});

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
 *  4. Знеособлення замовлень → відгуки анонімні (рейтинг лишається) →
 *     відкликання токенів → `DELETE users` (каскад решти графа).
 *  5. `eraseMedia(tx, ref)` ОСТАННІМ: рядок `media` → файл → COMMIT. Відмова
 *     диска відкочує все; збій самого COMMIT лишає лише «рядок без файла», що
 *     лікується повтором (`ENOENT` — успіх). Окремої транзакції для аватара
 *     немає: інакше роль, видана між перевіркою й стиранням, стерла б аватар
 *     нового адміна при відмові видалення.
 */
export const deleteCustomerOp = async ({
  data,
}: {
  data: z.input<typeof deleteCustomerInput>;
}): Promise<{ erasedOrders: number; anonymizedReviews: number }> => {
  const input = parseAdminInput(deleteCustomerInput, data);
  return runAdmin('customer.delete', async (db, grant) => {
    await advisoryXactLock(db, customerCategoryLock(input.userId));
    await advisoryXactLock(db, ADMIN_ROLES_LOCK);
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
    if (input.userId === grant.subject.userId)
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
    const anonymized = await db
      .update(productReviews)
      .set({ userId: null })
      .where(eq(productReviews.userId, input.userId))
      .returning({ id: productReviews.id });
    await revokeUserVerifications(db, {
      userId: input.userId,
      email: user.email,
    });
    await db.delete(users).where(eq(users.id, input.userId));
    if (avatarRef) await eraseMedia(db, avatarRef);
    return { erasedOrders, anonymizedReviews: anonymized.length };
  });
};
