import { eq } from 'drizzle-orm';
import { stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';
import { loadTargetStatus, setTargetStatus } from './stock-status';
import {
  lockTargetStock,
  servingQuantity,
  type StockLine,
} from './stock-write';

/** Нестача залишку: транзакція відкочується, замовлення не створюється. */
export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string | null,
    readonly modificationId: string | null,
  ) {
    super('[simplycms/orders] insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

/**
 * Списує позицію з ОДНІЄЇ точки — тієї, що обслуговує замовлення.
 *
 * 🔴 Викликається ПІД `app_admin` (operator) у транзакції замовлення.
 * Рядки залишків беруться `FOR UPDATE`: доки транзакція не завершилась, вони
 * наші, тож і достатність, і переворот статусу рахуються від РЕАЛЬНОГО
 * залишку, а не від знімка до чужого коміту (два паралельні замовлення по
 * одиниці на залишок 2 інакше лишили б нуль при `in_stock`).
 *
 * 🔴 Рішення архітектора B: для цілі зі статусом `on_order` достатність НЕ
 * перевіряється — «під замовлення» продається і на нулі, і в мінус (DDL
 * дозволяє: `quantity` без CHECK ≥0), борг лягає на постачання. Якщо рядка
 * на РЕЗОЛВЛЕНІЙ точці немає — тихий вихід: рядок не вигадується навіть для
 * `on_order`. Фліпів статусу для `on_order` і так немає (`setTargetStatus`
 * гвардований), тож нижче він і не викликається.
 *
 * Дві різні відсутності (для решти статусів) — два різні наслідки, і
 * плутати їх не можна: жодного рядка по жодній ОБСЛУГОВУЮЧІЙ точці
 * (`is_active` або `is_system` — предикат `lockTargetStock`) — магазин
 * обліку цієї цілі НЕ веде, вихід без змін; рядки на обслуговуючих точках
 * є, але не на нашій (або їх там менше) — облік ведеться, а точка не
 * покриває, тобто `InsufficientStockError`, а не тихий продаж із повітря.
 * Залишок, що лежить лише на закритій точці, навмисно потрапляє в ПЕРШУ
 * гілку: read-side його теж не бачить (`stock-info.ts:76`).
 *
 * Коли сума по точках стає 0 — статус переводиться в `out_of_stock`: саме
 * так read-side правило `isPurchasable` (статус, не кількість) лишається
 * правдивим для магазину, що веде облік. Фліп саме за СУМОЮ, а не за нашою
 * точкою: товар із залишком на сусідній точці інакше зникав би з продажу
 * разом із першою спорожнілою.
 */
export async function reserveStock(
  db: ActorDb,
  line: StockLine,
  pointId: string,
): Promise<void> {
  // Позиція без цілі обліку (ні товару, ні модифікації) — нічого списувати.
  if (!line.modificationId && !line.productId) return;
  const rows = await lockTargetStock(db, line);
  if (rows.length === 0) return;

  const row = rows.find((candidate) => candidate.pointId === pointId);

  if ((await loadTargetStatus(db, line)) === 'on_order') {
    if (!row) return;
    await db
      .update(stockByPickupPoint)
      .set({ quantity: row.quantity - line.quantity, updatedAt: new Date() })
      .where(eq(stockByPickupPoint.id, row.id));
    return;
  }

  if (!row || row.quantity < line.quantity) {
    throw new InsufficientStockError(line.productId, line.modificationId);
  }

  await db
    .update(stockByPickupPoint)
    .set({
      quantity: row.quantity - line.quantity,
      updatedAt: new Date(),
    })
    .where(eq(stockByPickupPoint.id, row.id));

  // 🔴 Інваріант, а не обіцянка: списуємо з рядка, який САМ обслуговує.
  // Сьогодні це no-op (`lockTargetStock` тут без `includePointId`), але
  // якщо колись передадуть — `left` віднімав би кількість із суми, у якій
  // цього рядка НЕМАЄ, і статус хибно фліпнув би в `out_of_stock`. Дзеркало
  // гварда `row.serving` у `releaseStock`: обидва шляхи фліпають статус лише
  // тоді, коли записаний рядок належить обслуговуючому набору.
  if (!row.serving) return;

  const left = servingQuantity(rows) - line.quantity;
  if (left === 0) await setTargetStatus(db, line, 'out_of_stock');
}
