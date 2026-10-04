import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { releaseStock } from './stock-release';

/**
 * Повернення залишку позиції при її ВИДАЛЕННІ (Е5б-7′ п.4). Окремо від
 * `./order-item-stock` заради канону 150 рядків; порядок локів — той самий
 * («orders» викликача → `order_items` → залишок), докблок там.
 */

/** Точку видалено (FK SET NULL) — повернути нікуди, факт логується (Е5-11). */
export const warnLost = (orderItemId: string, units: number) =>
  console.warn(
    `[simplycms/inventory] order item ${orderItemId}: stock point deleted, ${units} unit(s) not returned`,
  );

interface TakenItem {
  productId: string | null;
  modificationId: string | null;
  stockPointId: string | null;
  quantity: number;
}

/**
 * Видалення позиції (Е5б-7′ п.4): повертає рівно `stock_reserved` у точку
 * позиції й обнуляє лічильник ОДНИМ запитом — CTE `FOR UPDATE` бере старе
 * значення, data-modifying CTE обнуляє (прийом `releaseOrderStock`), тож
 * повторний виклик бачить 0. Точку видалено — Е5-11: `console.warn`,
 * повернення немає, лічильник обнуляється. `DELETE` робить викликач.
 *
 * @returns скільки одиниць фактично повернуто на залишок.
 */
export async function releaseOrderItemStock(
  db: ActorDb,
  orderItemId: string,
): Promise<{ released: number }> {
  const result = await db.execute(sql`
    with taken as (
      select id, product_id, modification_id, stock_point_id, stock_reserved
        from public.order_items
       where id = ${orderItemId}
         for update
    ), cleared as (
      update public.order_items oi set stock_reserved = 0
        from taken where oi.id = taken.id and taken.stock_reserved > 0
    )
    select product_id as "productId", modification_id as "modificationId",
           stock_point_id as "stockPointId", stock_reserved as "quantity"
      from taken`);
  const [row] = result.rows as unknown as TakenItem[];
  if (!row)
    throw new Error(
      `[simplycms/inventory] order item ${orderItemId} not found`,
    );
  if (row.quantity <= 0) return { released: 0 };
  if (!row.stockPointId) {
    warnLost(orderItemId, row.quantity);
    return { released: 0 };
  }
  await releaseStock(db, row, row.stockPointId);
  return { released: row.quantity };
}
