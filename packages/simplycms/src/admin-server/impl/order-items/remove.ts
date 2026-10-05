import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { releaseOrderItemStock } from 'simplycms/inventory';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import {
  lockEditableOrder,
  lockOrderItem,
  stateConflict,
  type OrderItemsEditResult,
} from './editable';
import { recomputeOrderTotals } from './totals';

export const removeOrderItemInput = z.object({
  orderId: z.uuid(),
  orderItemId: z.uuid(),
});

/**
 * Видалення позиції (Е5б-7′ п.4, Е5б-8, Е5б-9). Останню позицію видалити не
 * можна — 409 `order_last_item` (замовлення без позицій позбавлене сенсу).
 *
 * Порядок — КАНОН Е5б-8: (1)–(2) лок замовлення й гвард «скасоване»;
 * (3) лок позиції цього замовлення; (4) `releaseOrderItemStock` повертає
 * рівно `stock_reserved`; (5) `DELETE`; (6)–(8) `recomputeOrderTotals`
 * (доставка від нового `subtotal` — може зрости або стати недоступною).
 */
export const removeOrderItemOp = async ({
  data,
}: {
  data: z.infer<typeof removeOrderItemInput>;
}): Promise<OrderItemsEditResult> => {
  const { orderId, orderItemId } = parseAdminInput(removeOrderItemInput, data);
  return runAdmin('order.manage', async (db) => {
    const order = await lockEditableOrder(db, orderId);
    await lockOrderItem(db, orderId, orderItemId);
    // Позиції цього замовлення змінює лише той, хто тримає лок замовлення
    // (крок 1), тож лічильник стабільний до кінця транзакції.
    const [{ items }] = (await db
      .select({ items: count() })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))) as [{ items: number }];
    if (items <= 1) stateConflict(ADMIN_STATE_CONSTRAINT.orderLastItem);

    await releaseOrderItemStock(db, orderItemId);
    await db.delete(orderItems).where(eq(orderItems.id, orderItemId));
    return {
      order: await recomputeOrderTotals(db, order),
      upserted: [],
      removedIds: [orderItemId],
    };
  });
};
