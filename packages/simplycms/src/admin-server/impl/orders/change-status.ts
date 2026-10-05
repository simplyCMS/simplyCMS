import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { setResponseStatus } from '@tanstack/react-start/server';
import { orders, orderStatuses } from 'simplycms/schema';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { releaseOrderStock } from 'simplycms/inventory';
import type { ActorDb } from 'simplycms/db';
import { runAdmin } from '../run';
import { pickColumns } from '../resource';
import { AdminConflictError } from '../errors';
import { ORDERS_OMIT, type OrderRow } from './resource';

export const changeOrderStatusInput = z.object({
  orderId: z.uuid(),
  statusId: z.uuid(),
});

/** Проєкція SELECT/RETURNING — та сама, що в `ordersOps` (без `omit`). */
const projection = pickColumns(orders, ORDERS_OMIT);

/** Код статусу за id (`null` — статусу немає); спільний з `../order-items/editable`. */
export const statusCode = async (db: ActorDb, id: string | null) => {
  if (id === null) return null;
  const [row] = await db
    .select({ code: orderStatuses.code })
    .from(orderStatuses)
    .where(eq(orderStatuses.id, id));
  return row ? row.code : null;
};

/**
 * Зміна статусу замовлення адміном (Е5-2). Порядок у ОДНІЙ транзакції — канон:
 *
 * 1. `select … from orders where id = $1 for update` — той самий лок рядка,
 *    що `lockOrderStatus` скасування кабінетом покупця: паралельні адмін і
 *    покупець серіалізуються, друга сторона бачить уже змінений статус.
 * 2. «Скасоване — кінцеве» (Е5-13) — ДО no-op: і `cancelled → cancelled`
 *    відмовляє, інакше повторний запит тихо пройшов би.
 * 3. Цільовий статус мусить існувати; цільовий = поточний → no-op.
 * 4. Скасування → `releaseOrderStock` (Е5-4′) ПЕРЕД зміною статусу: облік
 *    по позиціях, повертає рівно списане й обнуляє лічильник.
 * 5. `update … returning` — без `access_token` (Е5-7).
 */
export const changeOrderStatusOp = async ({
  data,
}: {
  data: z.infer<typeof changeOrderStatusInput>;
}): Promise<{ order: OrderRow }> => {
  const { orderId, statusId } = changeOrderStatusInput.parse(data);
  return runAdmin('order.manage', async (db) => {
    // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: проєкція `Record<string, Column>` (з `getTableColumns(Table)`) не є pg `SelectedFields`;
    // та сама проєкція, що й у фабриці.
    const [current] = (await db
      .select(projection as never)
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update')) as OrderRow[];
    if (!current)
      throw new Error(`[admin-server] замовлення ${orderId} не існує`);

    if (
      (await statusCode(db, current.statusId)) === ORDER_STATUS_CODE.cancelled
    ) {
      setResponseStatus(409);
      throw new AdminConflictError(
        'state',
        ADMIN_STATE_CONSTRAINT.orderCancelledFinal,
      );
    }

    const target = await statusCode(db, statusId);
    if (target === null)
      throw new Error(`[admin-server] статусу ${statusId} не існує`);
    if (current.statusId === statusId) return { order: current };

    if (target === ORDER_STATUS_CODE.cancelled)
      await releaseOrderStock(db, orderId);

    const [order] = (await db
      .update(orders)
      .set({ statusId, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md
      .returning(projection as never)) as OrderRow[];
    return { order: order! };
  });
};
