import { asc, desc, eq, or } from 'drizzle-orm';
import { pickupPoints } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';
import type { StockTarget } from './stock-status';

/**
 * Адресація обліку залишків (К2-Е0, Е0-3): яка точка обслуговує замовлення.
 *
 * 🔴 Переїхало сюди зі `storefront/loaders` (Е5-3): облік замовлення —
 * спільний для вітрини (оформлення/скасування покупцем) і адмінки (зміна
 * статусу), а `admin-server` за тір-зонами не сміє імпортувати
 * `storefront/loaders`. Сусіди імпортуються НАПРЯМУ (`./stock-status`,
 * `./locked-stock`), не через барель `simplycms/inventory` — інакше цикл
 * барель ↔ модуль.
 */

/** Рух залишку однієї цілі: скільки списати або повернути. */
export interface StockMove extends StockTarget {
  quantity: number;
}

/**
 * Позиція замовлення в тому вигляді, який потрібен обліку. `orderItemId` —
 * ключ рядка `order_items`, у який пишеться фактично списане (Е5-4′).
 */
export interface StockLine extends StockMove {
  orderItemId: string;
}

/**
 * Точка, яка обслуговує це замовлення, — рівно ОДНА і детермінована.
 * Порядок: (1) точка самовивозу замовлення; (2) системна (`is_system` —
 * склад, звідки їдуть курʼєрські); (3) перша активна за `(sort_order, id)`.
 *
 * 🔴 `is_system` навмисно НЕ фільтрується по `is_active`: той керує лише
 * тим, чи пропонувати точку покупцеві як самовивіз (`loadPickupPoints`), а
 * не тим, чи існує склад. 🔴 `null` — «точок немає взагалі»: обліку в такому
 * магазині вести нічим, і write-side не вигадує його за магазин.
 *
 * 🔴 Лише для СПИСАННЯ (Е5-11): повернення бере точку з
 * `order_items.stock_point_id`, записану при оформленні, і резолвом не
 * користується — інакше точка, деактивована між оформленням і скасуванням,
 * перенаправила б повернення в іншу.
 */
export async function resolveStockPoint(
  db: ActorDb,
  pickupPointId: string | null,
): Promise<string | null> {
  if (pickupPointId) return pickupPointId;
  const [row] = await db
    .select({ id: pickupPoints.id })
    .from(pickupPoints)
    .where(or(eq(pickupPoints.isSystem, true), eq(pickupPoints.isActive, true)))
    .orderBy(
      desc(pickupPoints.isSystem),
      asc(pickupPoints.sortOrder),
      asc(pickupPoints.id),
    )
    .limit(1);
  return row?.id ?? null;
}
