import { and, eq } from 'drizzle-orm';
import { orderItems, orders } from 'simplycms/schema';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { InsufficientStockError } from 'simplycms/inventory';
import type { ActorDb } from 'simplycms/db';
import { pickColumns } from '../resource';
import { stateConflict } from '../errors';
import { ORDERS_OMIT, type OrderRow } from '../orders/resource';
import { statusCode } from '../orders/change-status';

/** Рядок позиції замовлення, який бачить адмінка (усі колонки, Е5-1). */
export type OrderItemRow = typeof orderItems.$inferSelect;

/**
 * Відповідь операцій редагування позицій (Е5б-8): клієнт пише її у колекції
 * як є (Е5б-11) — оптимістичного стану немає, бо ціну, доставку й залишок
 * рахує сервер.
 */
export interface OrderItemsEditResult {
  order: OrderRow;
  upserted: OrderItemRow[];
  removedIds: string[];
}

/** Проєкція замовлення — та сама, що в `ordersOps` і `changeOrderStatusOp` (без `accessToken`). */
export const orderProjection = pickColumns(orders, ORDERS_OMIT);

/**
 * Кроки (1)–(2) КАНОНУ Е5б-8: `select … from orders where id = $1 for update`
 * — той самий лок рядка, що в `cancelOwnOrder` і `changeOrderStatusOp`
 * (порядок «orders → order_items → stock», циклу локів немає), і гвард
 * «скасоване — кінцеве» ДО будь-якої роботи.
 */
export async function lockEditableOrder(
  db: ActorDb,
  orderId: string,
): Promise<OrderRow> {
  // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: проєкція `Record<string, Column>` (з `getTableColumns(Table)`) не є pg `SelectedFields`;
  // та сама проєкція, що й у фабриці.
  const [order] = (await db
    .select(orderProjection as never)
    .from(orders)
    .where(eq(orders.id, orderId))
    .for('update')) as OrderRow[];
  if (!order) throw new Error(`[admin-server] замовлення ${orderId} не існує`);
  if ((await statusCode(db, order.statusId)) === ORDER_STATUS_CODE.cancelled)
    stateConflict(ADMIN_STATE_CONSTRAINT.orderCancelledFinal);
  return order;
}

/**
 * Крок (3) для update/remove: позиція САМЕ цього замовлення під
 * `FOR UPDATE`. Чужа чи відсутня — помилка викликача (500), не конфлікт:
 * адмінка такого id не надсилає.
 */
export async function lockOrderItem(
  db: ActorDb,
  orderId: string,
  orderItemId: string,
): Promise<OrderItemRow> {
  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, orderId)))
    .for('update');
  if (!item)
    throw new Error(
      `[admin-server] позиція ${orderItemId} не існує або не належить замовленню ${orderId}`,
    );
  return item;
}

/**
 * Нестача залишку (Е5б-7′) → 409 `order_insufficient_stock`. `runAdmin`
 * мапить лише коди Postgres (`run.ts`), а `InsufficientStockError` — доменна
 * помилка обліку, тож перекладається тут; транзакція відкочується.
 */
export async function stockConflictAs409<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof InsufficientStockError)
      stateConflict(ADMIN_STATE_CONSTRAINT.orderInsufficientStock);
    throw error;
  }
}
