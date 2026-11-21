import { eq } from 'drizzle-orm';
import { orderItems, orders } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';
import { warnLost } from './order-item-release';
import { loadStockManagement } from './order-stock';
import { releaseStock } from './stock-release';
import { reserveStock } from './stock-reservation';
import { resolveStockPoint } from './stock-write';

/**
 * Дельта залишку по ОДНІЙ позиції оформленого замовлення —
 * редагування позицій в адмінці. 🔴 Єдина правда — лічильник фактично
 * списаного `order_items.stock_reserved`, а не наявність
 * `stock_point_id`: `reserveOrderStock` пише точку й при списаному 0.
 *
 * 🔴 Усі три функції (третя — `./order-item-release`) — під уже взятим
 * викликачем `orders … FOR UPDATE`. Самі беруть `order_items … FOR UPDATE` своєї позиції, потім залишок
 * (`lockTargetStock` усередині `reserveStock`/`releaseStock`) — порядок
 * «orders → order_items → stock», той самий, що в `releaseOrderStock` і
 * `cancelOwnOrder`; ціль одна, тож порядок рядкових локів детермінований.
 * Сусіди — прямими імпортами, не через барель (цикл барель ↔ модуль).
 */

interface LockedItem {
  orderId: string;
  productId: string | null;
  modificationId: string | null;
  quantity: number;
  stockPointId: string | null;
  stockReserved: number;
}

/** Позиція під `FOR UPDATE`; відсутність — помилка викликача, не тиша. */
async function lockItem(db: ActorDb, orderItemId: string): Promise<LockedItem> {
  const [row] = await db
    .select({
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      modificationId: orderItems.modificationId,
      quantity: orderItems.quantity,
      stockPointId: orderItems.stockPointId,
      stockReserved: orderItems.stockReserved,
    })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .for('update');
  if (!row)
    throw new Error(
      `[simplycms/inventory] order item ${orderItemId} not found`,
    );
  return row;
}

/**
 * Нова позиція. 🔴 Рядок ВЖЕ вставлено викликачем зі
 * `stock_point_id = NULL`, `stock_reserved = 0`. Тумблер
 * `decrease_on_order` читається ЗАРАЗ: увімкнено — точка
 * `resolveStockPoint(orders.pickup_point_id)` і фактично списане пишуться в
 * позицію; вимкнено (або точок немає) — позиція лишається необліковою.
 * Ціль і кількість беруться із заблокованого рядка — тому в аргументі їх
 * немає (мертві поля прибрано, щоб викликач не вважав їх
 * джерелом правди).
 */
export async function reserveNewOrderItemStock(
  db: ActorDb,
  item: { orderItemId: string; orderId: string },
): Promise<{ stockPointId: string | null; reserved: number }> {
  const row = await lockItem(db, item.orderItemId);
  if (row.orderId !== item.orderId)
    throw new Error(
      `[simplycms/inventory] order item ${item.orderItemId} belongs to another order`,
    );
  if (row.stockPointId !== null || row.stockReserved !== 0)
    throw new Error(
      `[simplycms/inventory] order item ${item.orderItemId} is already accounted`,
    );

  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return { stockPointId: null, reserved: 0 };
  const [order] = await db
    .select({ pickupPointId: orders.pickupPointId })
    .from(orders)
    .where(eq(orders.id, item.orderId));
  const pointId = await resolveStockPoint(db, order?.pickupPointId ?? null);
  if (!pointId) return { stockPointId: null, reserved: 0 };

  const reserved = await reserveStock(db, row, pointId);
  await db
    .update(orderItems)
    .set({ stockPointId: pointId, stockReserved: reserved })
    .where(eq(orderItems.id, item.orderItemId));
  return { stockPointId: pointId, reserved };
}

/**
 * Зміна кількості; саму кількість пише викликач. Збільшення на Δ — лише для облікової позиції (`stock_point_id`
 * задано): `reserveStock(Δ)` у її точку, лічильник += фактично списане
 * (`InsufficientStockError` пробрасується). Зменшення на Δ повертає
 * `r = min(Δ, stock_reserved)` — рівно те, що справді списали; `r = 0` —
 * залишок не чіпається. Точку видалено (NULL при `stock_reserved > 0`) —
 * як при видаленні позиції: повернення немає, лічильник зменшується, факт логується.
 *
 * @returns новий `stock_reserved` позиції.
 */
export async function adjustOrderItemStock(
  db: ActorDb,
  orderItemId: string,
  newQuantity: number,
): Promise<{ reserved: number }> {
  const row = await lockItem(db, orderItemId);
  const delta = newQuantity - row.quantity;
  let reserved = row.stockReserved;

  if (delta > 0 && row.stockPointId) {
    reserved += await reserveStock(
      db,
      { ...row, quantity: delta },
      row.stockPointId,
    );
  } else if (delta < 0) {
    const r = Math.min(-delta, reserved);
    if (r > 0) {
      if (row.stockPointId)
        await releaseStock(db, { ...row, quantity: r }, row.stockPointId);
      else warnLost(orderItemId, r);
      reserved -= r;
    }
  }

  if (reserved !== row.stockReserved)
    await db
      .update(orderItems)
      .set({ stockReserved: reserved })
      .where(eq(orderItems.id, orderItemId));
  return { reserved };
}
