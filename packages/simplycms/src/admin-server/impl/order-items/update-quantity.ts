import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems } from 'simplycms/schema';
import { adjustOrderItemStock } from 'simplycms/inventory';
import { runAdmin } from '../run';
import {
  lockEditableOrder,
  lockOrderItem,
  stockConflictAs409,
  type OrderItemsEditResult,
} from './editable';
import {
  MAX_CENTS_NUMERIC_12_2,
  assertWithin,
  fromCents,
  recomputeOrderTotals,
  toCents,
} from './totals';

export const updateOrderItemQuantityInput = z.object({
  orderId: z.uuid(),
  orderItemId: z.uuid(),
  quantity: z.number().int().min(1).max(9999),
});

/**
 * Зміна кількості позиції (Е5б-1, Е5б-7′, Е5б-8). Кількість множить
 * ЗБЕРЕЖЕНУ ціну позиції (знімок); та сама кількість — no-op без
 * перерахунку доставки.
 *
 * Порядок — КАНОН Е5б-8: (1)–(2) лок замовлення й гвард «скасоване»;
 * (3) лок позиції цього замовлення; межа `total` — до будь-якого запису;
 * (4) `adjustOrderItemStock` — 🔴 читає СТАРУ кількість із БД, тому
 * (5) `quantity` позиції пишеться ПІСЛЯ нього; (6)–(8) `recomputeOrderTotals`.
 */
export const updateOrderItemQuantityOp = async ({
  data,
}: {
  data: z.infer<typeof updateOrderItemQuantityInput>;
}): Promise<OrderItemsEditResult> => {
  const { orderId, orderItemId, quantity } =
    updateOrderItemQuantityInput.parse(data);
  return runAdmin('order.manage', async (db) => {
    const order = await lockEditableOrder(db, orderId);
    const item = await lockOrderItem(db, orderId, orderItemId);
    if (item.quantity === quantity)
      return { order, upserted: [item], removedIds: [] };

    const totalCents = toCents(item.price) * quantity;
    assertWithin(totalCents, MAX_CENTS_NUMERIC_12_2);

    await stockConflictAs409(() =>
      adjustOrderItemStock(db, orderItemId, quantity),
    );
    const [updated] = await db
      .update(orderItems)
      .set({ quantity, total: fromCents(totalCents) })
      .where(eq(orderItems.id, orderItemId))
      .returning();
    return {
      order: await recomputeOrderTotals(db, order),
      upserted: [updated!],
      removedIds: [],
    };
  });
};
