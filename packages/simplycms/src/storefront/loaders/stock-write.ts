import { and, asc, desc, eq, isNull, or, type SQL } from 'drizzle-orm';
import { pickupPoints, stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';

/**
 * Адресація обліку залишків (К2-Е0, Е0-3): яка точка обслуговує замовлення
 * і як заблокувати рядки цілі в цій транзакції. Переворот статусу —
 * `./stock-status`, правила «скільки списати й повернути» —
 * `./stock-reservation`.
 */

/** Ціль обліку: модифікація має пріоритет над простим товаром. */
export interface StockTarget {
  productId: string | null;
  modificationId: string | null;
}

/** Позиція замовлення в тому вигляді, який потрібен обліку. */
export interface StockLine extends StockTarget {
  quantity: number;
}

/** Рядок залишку, заблокований `FOR UPDATE` у поточній транзакції. */
export interface LockedStockRow {
  id: string;
  pointId: string;
  quantity: number;
}

/**
 * Точка, яка обслуговує це замовлення, — рівно ОДНА і детермінована.
 *
 * Порядок: (1) точка самовивозу самого замовлення; (2) системна точка
 * (`is_system` — склад магазину, звідки їдуть курʼєрські замовлення);
 * (3) перша активна за `(sort_order, id)`.
 *
 * 🔴 `is_system` навмисно НЕ фільтрується по `is_active`: `is_active` керує
 * тим, чи пропонувати точку покупцеві як самовивіз (`loadPickupPoints`), а
 * не тим, чи існує склад. Системна точка обслуговує облік і тоді, коли
 * магазин прибрав її з вибору самовивозу.
 *
 * 🔴 `null` означає «точок немає взагалі» — облік у такому магазині вести
 * нічим, і write-side не вигадує його за магазин.
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

/** Предикат цілі: модифікація або простий товар (`modification_id is null`). */
function targetScope(target: StockTarget): SQL | undefined {
  return target.modificationId
    ? eq(stockByPickupPoint.modificationId, target.modificationId)
    : and(
        eq(stockByPickupPoint.productId, target.productId as string),
        isNull(stockByPickupPoint.modificationId),
      );
}

/**
 * Залишки цілі по точках, які взагалі можуть обслужити замовлення, —
 * заблоковані `FOR UPDATE OF stock_by_pickup_point`.
 *
 * 🔴 Беруться ВСІ такі рядки, хоч списується рівно один: цей самий знімок
 * відповідає на два питання, на які інакше довелося б відповідати окремими
 * (і вже неблокованими) запитами — «чи веде магазин облік цієї цілі взагалі»
 * і «яка сума по точках після операції» (від неї фліп статусу). Предикат
 * точок — той самий, що в `resolveStockPoint`, інакше сума рахувалася б по
 * рядках, які нікого не обслуговують.
 *
 * 🔴 `of: stockByPickupPoint` обовʼязкове: у запиті є join на `pickup_points`,
 * а блокувати треба лише залишки (діалект емітить `for update of
 * "stock_by_pickup_point"`). Порядок `(sort_order, id)` — однаковий у всіх
 * транзакціях, тож рядки однієї цілі захоплюються в тій самій послідовності.
 */
export async function lockTargetStock(
  db: ActorDb,
  target: StockTarget,
): Promise<LockedStockRow[]> {
  return db
    .select({
      id: stockByPickupPoint.id,
      pointId: stockByPickupPoint.pickupPointId,
      quantity: stockByPickupPoint.quantity,
    })
    .from(stockByPickupPoint)
    .innerJoin(
      pickupPoints,
      eq(pickupPoints.id, stockByPickupPoint.pickupPointId),
    )
    .where(
      and(
        targetScope(target),
        or(eq(pickupPoints.isSystem, true), eq(pickupPoints.isActive, true)),
      ),
    )
    .orderBy(asc(pickupPoints.sortOrder), asc(stockByPickupPoint.id))
    .for('update', { of: stockByPickupPoint });
}
