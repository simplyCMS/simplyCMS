import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { userCategories } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { CUSTOMER_CONFIG_LOCK } from '../customer-lock';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const setDefaultUserCategoryInput = z.object({ id: z.uuid() });

/**
 * Дефолтна категорія покупців рівно одна (Е6в-18). Гість і профіль без
 * категорії оцінюються як дефолтна (Е6в-19) — вікна «нуль дефолтних» бути
 * не може. Порядок — як у `price-types/set-default.ts`:
 *  1. `CUSTOMER_CONFIG_LOCK` — ПЕРШИЙ запит (той самий бере
 *     `removeUserCategoriesOp`, тож remove(X) не вклиниться між читанням і
 *     UPDATE цілі).
 *  2. Ціль `FOR UPDATE`; немає — помилка. Уже дефолтна — no-op.
 *  3. Зняти дефолт з інших, ПОТІМ поставити цілі (інакше 23505 на частковому
 *     unique-індексі).
 *
 * Повертає УСІ змінені рядки — write-back колекції без refetch.
 */
export const setDefaultUserCategoryOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultUserCategoryInput>;
}) => {
  const { id } = parseAdminInput(setDefaultUserCategoryInput, data);
  return runAdmin('customer.manage', async (db) => {
    await lockCatalogTarget(db, CUSTOMER_CONFIG_LOCK);
    const [target] = await db
      .select()
      .from(userCategories)
      .where(eq(userCategories.id, id))
      .for('update');
    if (!target)
      throw new Error(`[admin-server] категорії покупців ${id} не існує`);
    if (target.isDefault) return { rows: [target] };
    const cleared = await db
      .update(userCategories)
      .set({ isDefault: false })
      .where(and(eq(userCategories.isDefault, true), ne(userCategories.id, id)))
      .returning();
    const [row] = await db
      .update(userCategories)
      .set({ isDefault: true })
      .where(eq(userCategories.id, id))
      .returning();
    if (!row)
      throw new Error(
        `[admin-server] категорія ${id} зникла під час призначення дефолту`,
      );
    return { rows: [...cleared, row] };
  });
};
