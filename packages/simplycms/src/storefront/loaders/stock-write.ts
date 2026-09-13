import { and, asc, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { pickupPoints, stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';

/**
 * Адресація обліку залишків (К2-Е0, Е0-3): яка точка обслуговує замовлення
 * і як заблокувати рядки цілі в цій транзакції. Переворот статусу —
 * `./stock-status`; правило списання — `./stock-reservation`, повернення —
 * `./stock-release` (розкладені по файлах заради канону 150 рядків).
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

/**
 * Рядок залишку, заблокований `FOR UPDATE` у поточній транзакції.
 *
 * 🔴 `serving` — чи ця ТОЧКА (не рядок) обслуговує замовлення (`is_system`
 * або `is_active`) — НЕЗАЛЕЖНО від того, чому рядок узагалі потрапив у
 * знімок. Потрібне рівно для того, щоб відокремити дві різні семантики,
 * які інакше злилися б в один запит (рев'ю I1-регрес): «куди писати
 * інкремент/декремент» (адресується `pointId`, бачить і НЕобслуговуючу
 * точку через `includePointId`) і «яка сума йде у фліп статусу» (мусить
 * бачити ЛИШЕ обслуговуючі точки — див. `stock-reservation.ts` і
 * `stock-release.ts`).
 */
export interface LockedStockRow {
  id: string;
  pointId: string;
  quantity: number;
  serving: boolean;
}

/**
 * Сума залишку по ОБСЛУГОВУЮЧИХ рядках знімка. 🔴 Інваріант САМОГО типу:
 * знімок може містити рядок, доданий лише через `includePointId` (точка
 * замовлення, яку вже деактивували), і він НЕ належить сумі, за якою
 * ухвалюється фліп статусу. Копії цього виразу в двох файлах уже двічі
 * розійшлись і коштували дефекту.
 */
export const servingQuantity = (rows: readonly LockedStockRow[]): number =>
  rows.reduce((sum, r) => (r.serving ? sum + r.quantity : sum), 0);

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
 * Залишки цілі по точках, які взагалі можуть обслужити замовлення (плюс,
 * опційно, одна конкретна точка поза цим правилом — `includePointId`), —
 * заблоковані `FOR UPDATE OF stock_by_pickup_point`. Що таке `serving` у
 * результаті — докблок `LockedStockRow` вище; тут — лише звідки береться
 * знімок.
 *
 * 🔴 Беруться ВСІ такі рядки, хоч списується рівно один: цей самий знімок
 * відповідає на два питання, на які інакше довелося б відповідати окремими
 * (і вже неблокованими) запитами — «чи веде магазин облік цієї цілі взагалі»
 * і «яка сума по ОБСЛУГОВУЮЧИХ точках після операції» (звідси й `serving` —
 * рахувати ту суму слід лише по ньому, див. `stock-reservation.ts`).
 *
 * 🔴 `includePointId` (рев'ю I1) — точка, яку треба бачити в знімку НЕЗАЛЕЖНО
 * від `is_active`/`is_system`. Потрібна ЛИШЕ на поверненні: замовлення могло
 * списати з точки, яку магазин деактивував уже ПІСЛЯ оформлення (рядок
 * залишку і далі існує — каскадом його прибирає лише ВИДАЛЕННЯ точки, не
 * зняття прапорця). Без цього параметра предикат «обслуговуючих» точок
 * ховає рядок від `releaseStock`, і той виходить гілкою «рядка немає»
 * (`if (!row) return`), хоча рядок насправді є і тримає списану кількість —
 * залишок губиться назавжди. На резервуванні цей параметр не передається:
 * там ховати рядки неактивної точки — навмисна поведінка (нову броню з
 * точки, яку магазин зняв із продажу, брати не можна).
 *
 * 🔴 `of: stockByPickupPoint` обовʼязкове: у запиті є join на `pickup_points`,
 * а блокувати треба лише залишки (діалект емітить `for update of
 * "stock_by_pickup_point"`). Порядок `(sort_order, id)` — однаковий у всіх
 * транзакціях, тож рядки однієї цілі захоплюються в тій самій послідовності.
 */
export async function lockTargetStock(
  db: ActorDb,
  target: StockTarget,
  includePointId?: string,
): Promise<LockedStockRow[]> {
  return db
    .select({
      id: stockByPickupPoint.id,
      pointId: stockByPickupPoint.pickupPointId,
      quantity: stockByPickupPoint.quantity,
      serving: sql<boolean>`(${pickupPoints.isSystem} or ${pickupPoints.isActive})`,
    })
    .from(stockByPickupPoint)
    .innerJoin(
      pickupPoints,
      eq(pickupPoints.id, stockByPickupPoint.pickupPointId),
    )
    .where(
      and(
        targetScope(target),
        or(
          eq(pickupPoints.isSystem, true),
          eq(pickupPoints.isActive, true),
          includePointId
            ? eq(stockByPickupPoint.pickupPointId, includePointId)
            : undefined,
        ),
      ),
    )
    .orderBy(asc(pickupPoints.sortOrder), asc(stockByPickupPoint.id))
    .for('update', { of: stockByPickupPoint });
}
