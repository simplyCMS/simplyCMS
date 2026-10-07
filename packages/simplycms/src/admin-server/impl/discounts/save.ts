import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  discountConditions,
  discountTargets,
  discounts,
  userCategories,
} from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import type { JsonValue } from 'simplycms/schema/types';
import { lockCatalogTarget } from '../catalog-lock';
import { CUSTOMER_CONFIG_LOCK } from '../customer-lock';
import { DISCOUNT_CONFIG_LOCK } from '../discount-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { saveDiscountInput, type SaveDiscountInput } from './save-input';

/** Id категорій з усіх умов `user_category` (значення вже пройшли реєстр). */
function categoryIds(conditions: SaveDiscountInput['conditions']): string[] {
  const ids = conditions
    .filter((c) => c.conditionType === 'user_category')
    .flatMap((c) => c.value as string[]);
  return [...new Set(ids)];
}

/**
 * Кожна категорія з умов існує (Е6в-16 ред.2). Порівняння `id::text`, а не
 * `inArray` по uuid: реєстр пропускає будь-який непорожній рядок, і не-uuid
 * дав би 22P02 (500) замість зрозумілої відмови.
 */
async function assertCategoriesExist(db: ActorDb, ids: string[]) {
  const found = await db
    .select({ id: userCategories.id })
    .from(userCategories)
    .where(inArray(sql`${userCategories.id}::text`, ids));
  if (found.length !== ids.length)
    stateConflict(ADMIN_STATE_CONSTRAINT.discountConditionCategoryMissing);
}

/**
 * Атомарний запис знижки (Е6в-16): рядок (upsert за `id` викликача), цілі
 * й умови замінюються ПОВНІСТЮ в ОДНІЙ транзакції; id цілей і умов генерує
 * сервер (прецедент `product-prices/save.ts`). Обрив на будь-якому кроці —
 * ROLLBACK усього: стара знижка лишається з попереднім набором.
 *
 * Локи — ПЕРШИМИ запитами, у глобальному порядку Е6в-15: з умовою
 * `user_category` — `CUSTOMER_CONFIG_LOCK`, потім `DISCOUNT_CONFIG_LOCK`;
 * під першим перевіряється, що категорії існують (видалення категорії,
 * на яку посилається умова, бере той самий ключ). Рядок знижки пишеться
 * ДО цілей і умов — на ньому тримається `FOR SHARE` у `getDiscountOp`.
 */
export const saveDiscountOp = async ({ data }: { data: SaveDiscountInput }) => {
  // А2: операція парсить вхід сама — прямий виклик повз serverFn теж 400.
  const input = parseAdminInput(saveDiscountInput, data);
  const { id, targets, conditions, discountValue, ...fields } = input;
  // Число → рядок `numeric` без округлення; `NaN`/`Infinity` відсік Zod.
  const patch = { ...fields, discountValue: String(discountValue) };
  const cats = categoryIds(conditions);
  return runAdmin('discount.manage', async (db) => {
    if (cats.length > 0) await lockCatalogTarget(db, CUSTOMER_CONFIG_LOCK);
    await lockCatalogTarget(db, DISCOUNT_CONFIG_LOCK);
    if (cats.length > 0) await assertCategoriesExist(db, cats);

    const [discount] = await db
      .insert(discounts)
      .values({ id, ...patch })
      .onConflictDoUpdate({
        target: discounts.id,
        set: { ...patch, updatedAt: new Date() },
      })
      .returning();

    await db.delete(discountTargets).where(eq(discountTargets.discountId, id));
    await db
      .delete(discountConditions)
      .where(eq(discountConditions.discountId, id));
    const savedTargets = await db
      .insert(discountTargets)
      .values(targets.map((t) => ({ id: randomUUID(), discountId: id, ...t })))
      .returning();
    const savedConditions =
      conditions.length === 0
        ? []
        : await db
            .insert(discountConditions)
            .values(
              conditions.map((c) => ({
                id: randomUUID(),
                discountId: id,
                conditionType: c.conditionType,
                operator: c.operator,
                value: c.value as JsonValue,
              })),
            )
            .returning();
    return {
      discount: discount!,
      targets: savedTargets,
      conditions: savedConditions,
    };
  });
};
