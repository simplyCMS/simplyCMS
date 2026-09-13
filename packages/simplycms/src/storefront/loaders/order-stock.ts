import { eq } from 'drizzle-orm';
import { orderItems, orders, systemSettings } from 'simplycms/schema';
import type { ActorDb } from './db';
import { releaseStock, reserveStock } from './stock-reservation';
import {
  resolveStockPoint,
  type StockLine,
  type StockTarget,
} from './stock-write';

/** Налаштування обліку: чи списувати залишок при оформленні. */
export async function loadStockManagement(
  db: ActorDb,
): Promise<{ decrease_on_order: boolean }> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'stock_management'))
    .limit(1);
  const value = (row?.value ?? {}) as { decrease_on_order?: unknown };
  return { decrease_on_order: value.decrease_on_order === true };
}

/**
 * Однаковий порядок блокувань у всіх транзакціях: два кошики з тими самими
 * товарами в різному порядку інакше могли б зійтися в дедлок (40P01).
 * Той самий порядок — і на поверненні.
 *
 * 🔴 Порівняння code-unit-ами (`<`/`>`), а НЕ `localeCompare`: ICU-колація
 * залежить від локалі й версії рушія, а порядок блокувань — канон
 * транзакцій і мусить бути однаковим завжди, незалежно від оточення.
 */
function sortForLock<T extends StockTarget>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const ka = `${a.productId}/${a.modificationId}`;
    const kb = `${b.productId}/${b.modificationId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Списати залишок усього замовлення — під ескалацією, у його транзакції. */
export async function reserveOrderStock(
  db: ActorDb,
  lines: StockLine[],
  pickupPointId: string | null,
): Promise<void> {
  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return;
  const pointId = await resolveStockPoint(db, pickupPointId);
  if (!pointId) return;
  for (const line of sortForLock(lines)) await reserveStock(db, line, pointId);
}

/**
 * Повернути залишок усього замовлення — під ескалацією, у транзакції
 * скасування.
 *
 * 🔴 Позиції й точка читаються З БАЗИ за `orderId`, а не приймаються
 * параметром: на скасуванні кошика в руках немає, а `orders.pickup_point_id`
 * — це і є та сама точка, у яку списували. Тому повернення точне без
 * окремої таблиці резервів. Той самий тумблер `decrease_on_order`, що й на
 * списанні: магазин без обліку скасуванням нічого не чіпає.
 */
export async function releaseOrderStock(
  db: ActorDb,
  orderId: string,
): Promise<void> {
  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return;

  const [order] = await db
    .select({ pickupPointId: orders.pickupPointId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return;

  const pointId = await resolveStockPoint(db, order.pickupPointId);
  if (!pointId) return;

  const lines = await db
    .select({
      productId: orderItems.productId,
      modificationId: orderItems.modificationId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of sortForLock(lines)) await releaseStock(db, line, pointId);
}
