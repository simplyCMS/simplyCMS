import { asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { shippingMethods } from 'simplycms/schema';
import { lockCatalogTarget } from '../catalog-lock';
import { runAdmin } from '../run';
import { assertAllFound, SHIPPING_CONFIG_LOCK } from '../shipping-lock';

export const removeShippingMethodsInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * Видалення способів доставки (Е6а-12, Е6а-17) — guarded batch:
 *  1. `SHIPPING_CONFIG_LOCK` — ПЕРШИЙ запит (серіалізує з insert точки, що
 *     перевіряє спосіб guard-ом).
 *  2. `FOR UPDATE … ORDER BY id` — детермінований порядок рядкових локів;
 *     відсутній id — помилка й ROLLBACK усього batch-у.
 *  3. DELETE. Спосіб із точками база не видаляє (FK `RESTRICT`, Е6а-17) —
 *     23503 у `AdminConflictError('reference')` перетворює `runAdmin`;
 *     точки, їхні залишки й тарифи способу лишаються недоторканими.
 */
export const removeShippingMethodsOp = async ({
  data,
}: {
  data: z.infer<typeof removeShippingMethodsInput>;
}) =>
  runAdmin('shipping.manage', async (db) => {
    await lockCatalogTarget(db, SHIPPING_CONFIG_LOCK);
    const ids = data.map((d) => d.id);
    const found = await db
      .select({ id: shippingMethods.id })
      .from(shippingMethods)
      .where(inArray(shippingMethods.id, ids))
      .orderBy(asc(shippingMethods.id))
      .for('update');
    assertAllFound('shipping_methods', ids, found);
    const deleted = await db
      .delete(shippingMethods)
      .where(inArray(shippingMethods.id, ids))
      .returning({ id: shippingMethods.id });
    return { count: deleted.length };
  });
