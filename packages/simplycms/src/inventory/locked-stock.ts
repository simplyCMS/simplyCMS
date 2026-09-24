import { and, asc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { pickupPoints, stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from 'simplycms/db';
import type { StockTarget } from './stock-status';

/**
 * Рядок залишку, заблокований `FOR UPDATE` у поточній транзакції.
 *
 * 🔴 Перенесено сюди зі `storefront/loaders/stock-write.ts` (М1, рев'ю
 * хвилі B): те саме правило «обслуговуюча точка» потрібне й адмінці
 * (`admin-server/impl/stock/save.ts`) — одна копія, не дві.
 *
 * 🔴 `serving` — чи ця ТОЧКА (не рядок) обслуговує замовлення (`is_system`
 * або `is_active`) — НЕЗАЛЕЖНО від того, чому рядок узагалі потрапив у
 * знімок. Потрібне рівно для того, щоб відокремити дві різні семантики,
 * які інакше злилися б в один запит (рев'ю I1-регрес): «куди писати
 * інкремент/декремент» (адресується `pointId`, бачить і НЕобслуговуючу
 * точку через `includePointId`) і «яка сума йде у фліп статусу» (мусить
 * бачити ЛИШЕ обслуговуючі точки — див. `stock-reservation.ts` і
 * `stock-release.ts`, а тепер і `saveStock` адмінки).
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
 * рахувати ту суму слід лише по ньому).
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
 * точки, яку магазин зняв із продажу, брати не можна). Ручний облік
 * адмінки (`saveStock`) теж не передає його: там ціль блокується ПОВНІСТЮ
 * окремим запитом (усі точки, не лише обслуговуючі) — цей знімок їй
 * потрібен ЛИШЕ для перерахунку статусу.
 *
 * 🔴 `of: stockByPickupPoint` обовʼязкове: у запиті є join на `pickup_points`,
 * а блокувати треба лише залишки (діалект емітить `for update of
 * "stock_by_pickup_point"`). Порядок `(sort_order, id)` — однаковий у всіх
 * транзакціях, тож рядки однієї цілі захоплюються в тій самій послідовності
 * — саме цей порядок і повторює `saveStock` адмінки для СВОГО ширшого локу.
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
