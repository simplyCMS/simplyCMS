import { inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { discounts } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { DISCOUNT_CONFIG_LOCK } from '../discount-lock';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { discountsOps } from './resource';

/** Вхід — та сама схема, що в колекції `discounts` (фабричний `removeSchema`). */
export const removeDiscountsInput = discountsOps.removeSchema;

/**
 * Видалення знижок (F6 фінального рев'ю К3-Е6в) під `DISCOUNT_CONFIG_LOCK` —
 * ПЕРШИМ запитом, як `saveDiscount` (Е6в-16) і видалення груп.
 *
 * 🔴 Без локу паралельний `saveDiscount` з тим самим `id` чекав би лише на
 * рядок: після COMMIT видалення його upsert вставив би знижку наново —
 * видалену власником знижку «воскрешав» би чужий запис. Фабричний `remove`
 * лок-хука Е6а-16 не бере (той покриває лише insert/update), тому —
 * іменована операція. Цілі й умови йдуть FK-каскадом; відповідь — та сама
 * `{ count }`, що чекає колекція.
 */
export const removeDiscountsOp = async ({
  data,
}: {
  data: z.infer<typeof removeDiscountsInput>;
}) => {
  const ids = parseAdminInput(removeDiscountsInput, data).map((d) => d.id);
  return runAdmin('discount.manage', async (db) => {
    await lockCatalogTarget(db, DISCOUNT_CONFIG_LOCK);
    const deleted = await db
      .delete(discounts)
      .where(inArray(discounts.id, ids))
      .returning({ id: discounts.id });
    return { count: deleted.length };
  });
};
