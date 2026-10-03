import { asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { priceTypes } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { runAdmin } from '../run';
import { PRICE_TYPE_DEFAULT_LOCK } from './set-default';

export const removePriceTypesInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * 🔴 remove для ЦІЄЇ сутності — іменований (Е4-2): «не видалити
 * дефолтний» — доменний інваріант, який частковий індекс не покриває (він
 * забороняє ДВА дефолти, не НУЛЬ).
 *
 * 🔴 Порядок (ред.2, аудит Codex, знахідка 2) — НЕ копія
 * `order-statuses/remove.ts`, де advisory-локу немає:
 *  1. advisory-lock `price-type-default` — ПЕРШИЙ запит транзакції, той
 *     самий, що в `setDefaultPriceTypeOp`: конкурентний setDefault(X) або
 *     вже завершився (X дефолтний — відмова нижче), або чекає й побачить,
 *     що X зник.
 *  2. Batch `FOR UPDATE … ORDER BY id` — детермінований порядок рядкових
 *     локів. Відсутній id або дефолтний серед них — помилка й ROLLBACK
 *     усього batch-у (БД і оптимістичний стан колекції не розходяться).
 *  3. DELETE. Тип, на який посилаються ціни, дає 23503 (RESTRICT, Е4-1) —
 *     у `AdminConflictError('reference')` його перетворює сам `runAdmin`.
 */
export const removeManyPriceTypesOp = async ({
  data,
}: {
  data: z.infer<typeof removePriceTypesInput>;
}) => {
  return runAdmin('catalog.write', async (db) => {
    await lockCatalogTarget(db, PRICE_TYPE_DEFAULT_LOCK);
    const ids = data.map((d) => d.id);
    const rows = await db
      .select()
      .from(priceTypes)
      .where(inArray(priceTypes.id, ids))
      .orderBy(asc(priceTypes.id))
      .for('update');
    if (rows.length !== new Set(ids).size) {
      const found = new Set(rows.map((r) => r.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new Error(
        `[admin-server] типів цін не існує: ${missing.join(', ')}`,
      );
    }
    if (rows.some((r) => r.isDefault))
      throw new Error(
        '[admin-server] дефолтний тип ціни видалити не можна — призначте інший дефолт',
      );
    const deleted = await db
      .delete(priceTypes)
      .where(inArray(priceTypes.id, ids))
      .returning();
    return { count: deleted.length };
  });
};
