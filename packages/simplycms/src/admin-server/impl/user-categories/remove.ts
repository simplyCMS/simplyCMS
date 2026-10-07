import { asc, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  categoryRules,
  discountConditions,
  profiles,
  userCategories,
} from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { lockCatalogTarget } from '../catalog-lock';
import { CUSTOMER_CONFIG_LOCK } from '../customer-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { assertAllFound } from '../shipping-lock';
import { parseAdminInput } from '../validation';

export const removeUserCategoriesInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * Умова знижки `user_category` тримає id категорій у jsonb без FK — саме тому
 * її перевіряє код (Е6в-18), а атомарність дає спільний з `saveDiscount`
 * `CUSTOMER_CONFIG_LOCK` (Е6в-16 ред.2).
 */
const referencedByDiscount = (ids: string[]) =>
  sql`${discountConditions.conditionType} = 'user_category'
      and jsonb_typeof(${discountConditions.value}) = 'array'
      and exists (select 1 from jsonb_array_elements_text(${discountConditions.value}) v
                   where v in (${sql.join(
                     ids.map((id) => sql`${id}`),
                     sql`, `,
                   )}))`;

/** Перша причина, з якої категорії видалити не можна, або `null`. */
async function blockingReason(db: ActorDb, ids: string[]) {
  const [customer] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(inArray(profiles.categoryId, ids))
    .limit(1);
  if (customer) return ADMIN_STATE_CONSTRAINT.userCategoryHasCustomers;
  const [rule] = await db
    .select({ id: categoryRules.id })
    .from(categoryRules)
    .where(
      or(
        inArray(categoryRules.fromCategoryId, ids),
        inArray(categoryRules.toCategoryId, ids),
      ),
    )
    .limit(1);
  if (rule) return ADMIN_STATE_CONSTRAINT.userCategoryHasRules;
  const [condition] = await db
    .select({ id: discountConditions.id })
    .from(discountConditions)
    .where(referencedByDiscount(ids))
    .limit(1);
  if (condition) return ADMIN_STATE_CONSTRAINT.userCategoryInDiscount;
  return null;
}

/**
 * Видалення категорій покупців (Е6в-18) — guarded batch, явні state-коди
 * замість загального «використовується»:
 *  1. `CUSTOMER_CONFIG_LOCK` — ПЕРШИЙ запит (його ж беруть запис категорій,
 *     setDefault, запис правил і `saveDiscount` з умовою `user_category`).
 *  2. `FOR UPDATE … ORDER BY id`; відсутній id — помилка всього batch.
 *  3. Дефолтна → `user_category_default`; покупці → `_has_customers`;
 *     правила (`from`/`to`) → `_has_rules`; умова знижки → `_in_discount`.
 *  4. DELETE. Історія лишається: FK `SET NULL` + знімок назви (Е6в-2).
 * FK (`profiles` NO ACTION, правила RESTRICT) — страховка позаду перевірок.
 */
export const removeUserCategoriesOp = async ({
  data,
}: {
  data: z.infer<typeof removeUserCategoriesInput>;
}) => {
  const ids = parseAdminInput(removeUserCategoriesInput, data).map((d) => d.id);
  return runAdmin('customer.manage', async (db) => {
    await lockCatalogTarget(db, CUSTOMER_CONFIG_LOCK);
    const found = await db
      .select({ id: userCategories.id, isDefault: userCategories.isDefault })
      .from(userCategories)
      .where(inArray(userCategories.id, ids))
      .orderBy(asc(userCategories.id))
      .for('update');
    assertAllFound('user_categories', ids, found);
    if (found.some((c) => c.isDefault))
      stateConflict(ADMIN_STATE_CONSTRAINT.userCategoryDefault);
    const blocked = await blockingReason(db, ids);
    if (blocked) stateConflict(blocked);
    const deleted = await db
      .delete(userCategories)
      .where(inArray(userCategories.id, ids))
      .returning({ id: userCategories.id });
    return { count: deleted.length };
  });
};
