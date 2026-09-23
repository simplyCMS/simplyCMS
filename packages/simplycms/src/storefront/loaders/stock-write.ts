import { asc, desc, eq, or } from 'drizzle-orm';
import { pickupPoints } from 'simplycms/schema';
import type { StockTarget } from 'simplycms/inventory';
import type { ActorDb } from './db';

/**
 * Адресація обліку залишків (К2-Е0, Е0-3): яка точка обслуговує замовлення.
 *
 * 🔴 М1 (рев'ю хвилі B): `lockTargetStock`/`servingQuantity`/`LockedStockRow`
 * переїхали в `simplycms/inventory` цілком (не лише `StockTarget`) — та сама
 * копія правила «обслуговуюча точка» потрібна й адмінці
 * (`admin-server/impl/stock/save.ts`). Тут лишається лише специфічне для
 * замовлення: резолв точки й переворот статусу — `simplycms/inventory`;
 * правило списання — `./stock-reservation`, повернення — `./stock-release`
 * (розкладені по файлах заради канону 150 рядків).
 */

// `StockTarget` живе в `simplycms/inventory` (Е3-5) — реекспорт тут заради
// сумісності: `order-stock.ts` бере тип саме звідси.
export type { StockTarget };

/** Позиція замовлення в тому вигляді, який потрібен обліку. */
export interface StockLine extends StockTarget {
  quantity: number;
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
