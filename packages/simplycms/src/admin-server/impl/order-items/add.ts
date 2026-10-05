import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { orderItems } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { priceItems } from 'simplycms/commerce';
import { reserveNewOrderItemStock } from 'simplycms/inventory';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import {
  lockEditableOrder,
  stateConflict,
  stockConflictAs409,
  type OrderItemsEditResult,
} from './editable';
import {
  MAX_CENTS_NUMERIC_12_2,
  assertWithin,
  centsFromNumber,
  fromCents,
  recomputeOrderTotals,
  toCents,
} from './totals';

export const addOrderItemInput = z.object({
  orderId: z.uuid(),
  productId: z.uuid(),
  modificationId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(9999),
});

/**
 * Додавання позиції до оформленого замовлення (Е5б-1, Е5б-8, Е5б-9).
 *
 * Ціна — рушієм чекауту (`priceItems`) для покупця замовлення (`orders.user_id`;
 * гість — дефолтний тип ціни й категорія). Контекст знижок «від суми» —
 * склад ПІСЛЯ додавання: `extraCartTotal = Σ (base_price ?? price) × quantity`
 * наявних позицій (центами); наявні позиції не переоцінюються. Той самий
 * товар — НОВИЙ рядок зі своєю ціною (знімки не змішуються).
 *
 * Порядок — КАНОН Е5б-8: (1)–(2) лок замовлення й гвард «скасоване»;
 * (3) СПОЧАТКУ `INSERT` позиції без обліку (`stock_point_id = NULL`,
 * `stock_reserved = 0`); (4) `reserveNewOrderItemStock` пише облік у вже
 * наявний рядок (нестача → 409, транзакція відкочує й вставку); (6)–(8)
 * `recomputeOrderTotals`.
 */
export const addOrderItemOp = async ({
  data,
}: {
  data: z.infer<typeof addOrderItemInput>;
}): Promise<OrderItemsEditResult> => {
  const { orderId, productId, modificationId, quantity } = parseAdminInput(
    addOrderItemInput,
    data,
  );
  return runAdmin('order.manage', async (db) => {
    const order = await lockEditableOrder(db, orderId);

    const existing = await db
      .select({
        price: orderItems.price,
        basePrice: orderItems.basePrice,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    const extraCents = existing.reduce(
      (sum, i) => sum + toCents(i.basePrice ?? i.price) * i.quantity,
      0,
    );
    const priced = await priceItems(
      db,
      order.userId,
      [{ productId, modificationId, quantity }],
      { extraCartTotal: extraCents / 100 },
    );
    if (priced === 'not_purchasable')
      stateConflict(ADMIN_STATE_CONSTRAINT.orderItemNotPurchasable);
    const line = priced[0]!;
    const priceCents = centsFromNumber(line.price);
    const totalCents = priceCents * quantity;
    assertWithin(priceCents, MAX_CENTS_NUMERIC_12_2);
    assertWithin(totalCents, MAX_CENTS_NUMERIC_12_2);

    const orderItemId = randomUUID();
    await db.insert(orderItems).values({
      id: orderItemId,
      orderId,
      productId,
      modificationId,
      name: line.name,
      price: fromCents(priceCents),
      quantity,
      total: fromCents(totalCents),
      basePrice:
        line.basePrice === null
          ? null
          : fromCents(centsFromNumber(line.basePrice)),
      discountData: line.discountData ?? null,
    });
    await stockConflictAs409(() =>
      reserveNewOrderItemStock(db, { orderItemId, orderId }),
    );

    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId));
    return {
      order: await recomputeOrderTotals(db, order),
      upserted: [item!],
      removedIds: [],
    };
  });
};
