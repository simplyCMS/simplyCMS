import { and, asc, gt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems, pickupPoints, stockByPickupPoint } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { lockCatalogTarget } from '../catalog-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { assertAllFound, SHIPPING_CONFIG_LOCK } from '../shipping-lock';

export const removePickupPointsInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * Видалення точок видачі (Е6а-12, Е6а-17): залишок не губиться видаленням.
 *
 * 0. `SHIPPING_CONFIG_LOCK` — ПЕРШИЙ запит. Точки читаються БЕЗ рядкового
 *    локу: `is_system` змінити нічим (readonly), а insert/update точок
 *    серіалізує той самий advisory. 🔴 `FOR UPDATE` на точках ДО рядків
 *    залишку дав би зворотний порядок відносно оформлення (рядки залишку →
 *    KEY SHARE на точку) і дедлок. Відсутній id — помилка, системна точка —
 *    `pickup_point_system`.
 * 1. `select … from stock_by_pickup_point … order by id for update` — той
 *    самий рядковий лок, що бере резерв замовлення (`lockTargetStock`):
 *    оформлення в польоті дочекається або буде дочекане.
 * 2. Рядок із `quantity <> 0` або позиція з `stock_point_id ∈ ids` і
 *    `stock_reserved > 0` — `pickup_point_has_stock` (FK позиції — SET NULL,
 *    тож без цієї перевірки повернення втратило б точку).
 * 3. Видалити нульові рядки залишку.
 * 4. Видалити точки. Рядок залишку, вставлений `saveStockOp` після кроку 1
 *    (інший advisory-ключ), тримає `FOR KEY SHARE` на точці — DELETE
 *    дочекається його COMMIT і впаде на FK `RESTRICT` → `reference`.
 */
export const removePickupPointsOp = async ({
  data,
}: {
  data: z.infer<typeof removePickupPointsInput>;
}) =>
  runAdmin('shipping.manage', async (db) => {
    await lockCatalogTarget(db, SHIPPING_CONFIG_LOCK);
    const ids = data.map((d) => d.id);
    const points = await db
      .select({ id: pickupPoints.id, isSystem: pickupPoints.isSystem })
      .from(pickupPoints)
      .where(inArray(pickupPoints.id, ids));
    assertAllFound('pickup_points', ids, points);
    if (points.some((p) => p.isSystem))
      stateConflict(ADMIN_STATE_CONSTRAINT.pickupPointSystem);

    const stock = await db
      .select({
        id: stockByPickupPoint.id,
        quantity: stockByPickupPoint.quantity,
      })
      .from(stockByPickupPoint)
      .where(inArray(stockByPickupPoint.pickupPointId, ids))
      .orderBy(asc(stockByPickupPoint.id))
      .for('update');
    const [reserved] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          inArray(orderItems.stockPointId, ids),
          gt(orderItems.stockReserved, 0),
        ),
      )
      .limit(1);
    if (reserved || stock.some((s) => s.quantity !== 0))
      stateConflict(ADMIN_STATE_CONSTRAINT.pickupPointHasStock);

    if (stock.length > 0)
      await db.delete(stockByPickupPoint).where(
        inArray(
          stockByPickupPoint.id,
          stock.map((s) => s.id),
        ),
      );
    const deleted = await db
      .delete(pickupPoints)
      .where(inArray(pickupPoints.id, ids))
      .returning({ id: pickupPoints.id });
    return { count: deleted.length };
  });
