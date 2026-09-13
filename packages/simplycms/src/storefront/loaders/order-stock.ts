import { eq, sql } from 'drizzle-orm';
import { orderItems, orders, systemSettings } from 'simplycms/schema';
import type { ActorDb } from './db';
import { releaseStock } from './stock-release';
import { reserveStock } from './stock-reservation';
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

/**
 * Списати залишок усього замовлення — під ескалацією, у його транзакції.
 *
 * 🔴 Резолвлена точка ЗАПИСУЄТЬСЯ в `orders.shipping_data.stock_point_id`.
 * Причина: для замовлення БЕЗ самовивозу `orders.pickup_point_id` порожній,
 * тож `resolveStockPoint` довелося б кликати вдруге на поверненні — і якби
 * між оформленням і скасуванням магазин деактивував ту точку, резолв віддав
 * би ІНШУ: списане з P1 повернулося б у P2 (P1 назавжди в мінусі, P2 плюс
 * із повітря). Запис у наявну jsonb-колонку — саме той шлях, який план
 * називає для видаленої точки, і він не потребує DDL.
 */
export async function reserveOrderStock(
  db: ActorDb,
  orderId: string,
  lines: StockLine[],
  pickupPointId: string | null,
): Promise<void> {
  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return;
  const pointId = await resolveStockPoint(db, pickupPointId);
  if (!pointId) return;

  await db
    .update(orders)
    .set({
      shippingData: sql`coalesce(${orders.shippingData}, '{}'::jsonb) || ${JSON.stringify({ stock_point_id: pointId })}::jsonb`,
    })
    .where(eq(orders.id, orderId));

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
    .select({
      pickupPointId: orders.pickupPointId,
      shippingData: orders.shippingData,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return;

  // 🔴 Точка СПИСАННЯ читається першою — вона записана при оформленні. Резолв
  // лишається лише відкатом для замовлень, оформлених ДО цієї правки: для них
  // `orders.pickup_point_id` або веде в ту саму точку (самовивіз), або
  // порожній, і тоді резолв може віддати іншу точку, ніж списували.
  const stored = (order.shippingData as { stock_point_id?: unknown } | null)
    ?.stock_point_id;
  const pointId =
    typeof stored === 'string' && stored
      ? stored
      : await resolveStockPoint(db, order.pickupPointId);
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
