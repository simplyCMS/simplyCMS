import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { profiles } from 'simplycms/schema';
import { advisoryXactLock } from 'simplycms/db';
import { customerCategoryLock, writeCategoryChange } from 'simplycms/commerce';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const assignCustomerCategoryInput = z.object({
  userId: z.uuid(),
  categoryId: z.uuid(),
  reason: z.string().trim().min(1).max(500),
  locked: z.boolean().default(true),
});

/**
 * Ручне призначення категорії покупцю (Е6в-20), `customer.manage`.
 *
 *  1. `customerCategoryLock(userId)` — ПЕРШИЙ запит: той самий бере
 *     `applyCategoryRules`, тож правило після замовлення не перезапише
 *     призначення посеред транзакції.
 *  2. Профіль `FOR UPDATE`; немає — помилка.
 *  3. Категорія змінилась → профіль + історія (`changed_by` = адмін,
 *     `rule_id = null`). Не змінилась — історії немає.
 *  4. `category_locked = locked` (за замовчуванням `true`): автоправила
 *     пропускають заблокованих — вручну призначений VIP не стане знову
 *     «Роздрібом» після чергової покупки.
 * Неіснуюча категорія — FK `profiles.category_id` → 409 `reference`.
 */
export const assignCustomerCategoryOp = async ({
  data,
}: {
  data: z.input<typeof assignCustomerCategoryInput>;
}): Promise<{ categoryId: string; locked: boolean }> => {
  const input = parseAdminInput(assignCustomerCategoryInput, data);
  return runAdmin('customer.manage', async (db, grant) => {
    await advisoryXactLock(db, customerCategoryLock(input.userId));
    const [profile] = await db
      .select({ categoryId: profiles.categoryId })
      .from(profiles)
      .where(eq(profiles.userId, input.userId))
      .for('update');
    if (!profile)
      throw new Error(
        `[admin-server] профілю покупця ${input.userId} не існує`,
      );
    if (profile.categoryId !== input.categoryId)
      await writeCategoryChange(db, {
        userId: input.userId,
        fromCategoryId: profile.categoryId,
        toCategoryId: input.categoryId,
        reason: input.reason,
        ruleId: null,
        changedBy: grant.subject.userId,
      });
    await db
      .update(profiles)
      .set({ categoryLocked: input.locked })
      .where(eq(profiles.userId, input.userId));
    return { categoryId: input.categoryId, locked: input.locked };
  });
};
