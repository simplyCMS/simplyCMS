import { and, eq, sql } from 'drizzle-orm';
import { orderItems, systemSettings } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';
import { releaseStock } from './stock-release';
import { reserveStock } from './stock-reservation';
import type { StockTarget } from './stock-status';
import { resolveStockPoint, type StockLine } from './stock-write';

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
 * 🔴 Е5-4′: облік фактично списаного — ПО ПОЗИЦІЇ. Кожна позиція отримує
 * `stock_point_id` (точку списання) і `stock_reserved` (скільки
 * `reserveStock` реально зняв — 0 для цілі без обліку). Маркер на рівні
 * замовлення (колишній `orders.shipping_data.stock_point_id`) не доводив
 * декременту: товар без обліку, якому пізніше завели рядок, або змішане
 * замовлення отримали б при скасуванні кількість, якої не списували.
 * Позиція адресується `order_items.id` (`StockLine.orderItemId`), а не
 * ціллю: дві позиції одного товару — два різні лічильники.
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

  for (const line of sortForLock(lines)) {
    const reserved = await reserveStock(db, line, pointId);
    await db
      .update(orderItems)
      .set({ stockPointId: pointId, stockReserved: reserved })
      .where(
        and(
          eq(orderItems.id, line.orderItemId),
          eq(orderItems.orderId, orderId),
        ),
      );
  }
}

interface TakenRow extends StockTarget {
  stockPointId: string | null;
  quantity: number;
}

/**
 * Повернути залишок усього замовлення — під ескалацією, у транзакції
 * скасування (вітрина) чи зміни статусу (адмінка).
 *
 * 🔴 Повертає РІВНО `stock_reserved` у `stock_point_id` кожної позиції й
 * обнуляє лічильник ОДНИМ запитом: CTE з `FOR UPDATE` бере старі значення,
 * data-modifying CTE обнуляє. Повторний виклик (паралельний чи послідовний)
 * бачить 0 — ідемпотентність тримає сам лічильник, незалежно від гварда
 * статусу. Тумблер `decrease_on_order` НЕ читається: повертається те, що
 * було списано, а не те, що списувалось би зараз.
 *
 * 🔴 Е5-11: fallback `resolveStockPoint` прибрано. Позиція з
 * `stock_point_id = NULL` (точку ВИДАЛИЛИ — FK `ON DELETE SET NULL`)
 * повернути нікуди: кількість не повертається, факт логується (межа —
 * `docs/tasks/v2-state-map.md`).
 *
 * @returns кількість позицій, по яких залишок ФАКТИЧНО повернуто: позиція з
 *   видаленою точкою або без рядка залишку на ній (лічильник обнулено,
 *   повертати нікуди) не рахується (Е5б Task 8).
 */
export async function releaseOrderStock(
  db: ActorDb,
  orderId: string,
): Promise<{ released: number }> {
  const result = await db.execute(sql`
    with taken as (
      select id, product_id, modification_id, stock_point_id, stock_reserved
        from public.order_items
       where order_id = ${orderId} and stock_reserved > 0
         for update
    ), cleared as (
      update public.order_items oi set stock_reserved = 0
        from taken where oi.id = taken.id
    )
    select product_id as "productId", modification_id as "modificationId",
           stock_point_id as "stockPointId", stock_reserved as "quantity"
      from taken`);
  const taken = result.rows as unknown as TakenRow[];

  let released = 0;
  for (const row of sortForLock(taken)) {
    if (!row.stockPointId) {
      console.warn(
        `[simplycms/inventory] order ${orderId}: stock point deleted, ${row.quantity} unit(s) not returned`,
      );
      continue;
    }
    if ((await releaseStock(db, row, row.stockPointId)) > 0) released += 1;
  }
  return { released };
}
