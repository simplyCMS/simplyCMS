import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  discountConditions,
  discountTargets,
  discounts,
} from 'simplycms/schema';
import { runAdmin } from '../run';

export const getDiscountInput = z.object({ id: z.uuid() });

/**
 * Знижка з цілями й умовами для форми редагування (Е6в-16).
 *
 * 🔴 `FOR SHARE` на рядку знижки — ПЕРШИЙ запит: `saveDiscountOp` оновлює
 * цей рядок до заміни цілей і умов, тож читання або чекає його COMMIT, або
 * не пускає його далі. Без цього три SELECT-и в READ COMMITTED могли б
 * зібрати старий рядок із новими цілями — стан, якого не було жодної миті.
 */
export const getDiscountOp = async ({
  data,
}: {
  data: z.infer<typeof getDiscountInput>;
}) =>
  runAdmin('discount.manage', async (db) => {
    const [discount] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, data.id))
      .for('share');
    if (!discount) throw new Error(`[admin-server] знижки ${data.id} не існує`);
    const targets = await db
      .select()
      .from(discountTargets)
      .where(eq(discountTargets.discountId, data.id))
      .orderBy(asc(discountTargets.id));
    const conditions = await db
      .select()
      .from(discountConditions)
      .where(eq(discountConditions.discountId, data.id))
      .orderBy(asc(discountConditions.id));
    return { discount, targets, conditions };
  });
