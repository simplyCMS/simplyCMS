import { eq } from 'drizzle-orm';
import { stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';
import { loadTargetStatus, setTargetStatus } from './stock-status';
import { lockTargetStock, type StockLine } from './stock-write';

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

  const left =
    rows.reduce((sum, item) => sum + item.quantity, 0) - line.quantity;
  if (left === 0) await setTargetStatus(db, line, 'out_of_stock');
}

/**
 * Повертає позицію В ТУ САМУ точку — дзеркало `reserveStock`.
 *
 * 🔴 Знімок береться з `includePointId: pointId` (рев'ю I1) — точка
 * ПОВЕРНЕННЯ мусить потрапити в блокування, навіть якщо магазин ЗНЯВ
 * прапорець `is_active` між замовленням і скасуванням: рядок залишку
 * (`stock_by_pickup_point`) при деактивації нікуди не дівається, і без
 * розширеного предиката `lockTargetStock` його ховала б та сама умова, що
 * ховає точку від НОВИХ бронювань, — залишок губився б НАЗАВЖДИ, бо гілка
 * «рядка немає» нижче мовчки виходить.
 *
 * 🔴 Тому `if (!row) return` тут означає рівно одне: рядка `stock_by_pickup_point`
 * на цій точці більше немає У БД ФІЗИЧНО — або точку ВИДАЛИЛИ (не
 * деактивували) і `stock_by_pickup_point_pickup_point_id_fkey`
 * (`ON DELETE cascade`) забрав рядок разом із нею, або сам рядок обліку
 * прибрали вручну. Це право покупця (скасування не сміє впасти через стан
 * складу), і вигадувати рядок замість магазину write-side не буде. Сюди ж
 * потрапляє й перша гілка `reserveStock` («обліку немає взагалі») зі свого
 * боку: `releaseOrderStock` резолвить уже ІНШУ точку для цього ордера, і
 * кількість ляже на неї — названа межа правила Р2 вище.
 *
 * 🔴 Дзеркало не абсолютне, і це свідомо: кількість повертається завжди, а
 * статус — лише з нуля (гвард нижче). Для `on_order` це працює саме тому,
 * що гвард дивиться на `out_of_stock → in_stock`: `on_order` під нього не
 * підпадає і лишається як є — окремої гілки тут не треба.
 */
export async function releaseStock(
  db: ActorDb,
  line: StockLine,
  pointId: string,
): Promise<void> {
  if (!line.modificationId && !line.productId) return;
  const rows = await lockTargetStock(db, line, pointId);
  if (rows.length === 0) return;
  const row = rows.find((candidate) => candidate.pointId === pointId);
  if (!row) return;

  // Сума ДО повернення — із того самого заблокованого знімка.
  const before = rows.reduce((sum, item) => sum + item.quantity, 0);

  await db
    .update(stockByPickupPoint)
    .set({
      quantity: row.quantity + line.quantity,
      updatedAt: new Date(),
    })
    .where(eq(stockByPickupPoint.id, row.id));

  // 🔴 Фліп назад — ЛИШЕ коли до повернення сума по точках була нулем: інакше
  // `out_of_stock` поставив не цей облік, а магазин (зняв товар з продажу при
  // ненульовому залишку), і скасування старого замовлення тихо скасувало б це
  // рішення. Дзеркальний вигляд `if (before + line.quantity > 0)` умовою не є
  // взагалі: `quantity` позиції завжди ≥ 1 (`order_items_positive_quantity`,
  // `schema.ts:247`), тобто такий гвард істинний завжди.
  if (before === 0) await setTargetStatus(db, line, 'in_stock');
}
