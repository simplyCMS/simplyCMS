import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { priceTypes } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { runAdmin } from '../run';

export const setDefaultPriceTypeInput = z.object({ id: z.uuid() });

/**
 * Advisory-ключ довідника типів цін (Е4-2). Спільний для setDefault і
 * remove — саме він серіалізує їх між собою.
 */
export const PRICE_TYPE_DEFAULT_LOCK = 'price-type-default';

/**
 * Дефолтний тип ціни рівно один (Е4-2). Вітрина й `PriceValidator` беруть
 * дефолт як fallback для гостя, тож вікна «нуль дефолтів» бути не може.
 *
 * 🔴 Порядок (ред.2, аудит Codex, знахідка 2) — НЕ копія
 * `product-modifications/set-default.ts`, який читає ціль до локу й не
 * перевіряє результат UPDATE:
 *  1. advisory-lock `price-type-default` — ПЕРШИЙ запит транзакції. Той
 *     самий бере `removeManyPriceTypesOp`, тож remove(X) не може
 *     завершитись між читанням X і UPDATE цілі незалежно від того, чи
 *     рядок-ціль ще існує (рядковий лок на відсутньому рядку не тримає).
 *  2. Ціль `FOR UPDATE`; немає — помилка. Уже дефолтна — no-op.
 *  3. Зняти дефолт з інших, ПОТІМ поставити цілі (зворотний порядок дав
 *     би два true під частковим unique-індексом → 23505).
 *  4. UPDATE цілі повернув 0 рядків — помилка: ROLLBACK повертає знятий
 *     прапорець, дефолт лишається старим.
 * Порядок «advisory → рядкові локи» — той самий, що в `catalog-lock.ts`;
 * вітрина рядків `price_types` не блокує, циклу очікування немає.
 *
 * Повертає УСІ змінені рядки (знятий дефолт + новий) — колекція адмінки
 * пише їх write-back-ом без refetch.
 */
export const setDefaultPriceTypeOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultPriceTypeInput>;
}) => {
  return runAdmin('catalog.write', async (db) => {
    await lockCatalogTarget(db, PRICE_TYPE_DEFAULT_LOCK);
    const [target] = await db
      .select()
      .from(priceTypes)
      .where(eq(priceTypes.id, data.id))
      .for('update');
    if (!target)
      throw new Error(`[admin-server] типу ціни ${data.id} не існує`);
    if (target.isDefault) return { rows: [target] };
    const cleared = await db
      .update(priceTypes)
      .set({ isDefault: false })
      .where(and(eq(priceTypes.isDefault, true), ne(priceTypes.id, data.id)))
      .returning();
    const [row] = await db
      .update(priceTypes)
      .set({ isDefault: true })
      .where(eq(priceTypes.id, data.id))
      .returning();
    if (!row)
      throw new Error(
        `[admin-server] тип ціни ${data.id} зник під час призначення дефолту`,
      );
    return { rows: [...cleared, row] };
  });
};
