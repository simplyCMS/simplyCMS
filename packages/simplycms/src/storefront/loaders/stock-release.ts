import { eq } from 'drizzle-orm';
import { stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';
import { setTargetStatus } from './stock-status';
import {
  lockTargetStock,
  servingQuantity,
  type StockLine,
} from './stock-write';

/**
 * Повертає позицію В ТУ САМУ точку — дзеркало `reserveStock`
 * (`./stock-reservation`); винесено в окремий файл заради канону 150
 * рядків (обидві функції разом із докблоками не вміщались в один).
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
 *
 * 🔴 Гвард фліпу (нижче) — ДВІ умови, не одна: `row.serving` точки повернення
 * і `before === 0` по обслуговуючих точках. Регрес повторного рев'ю: перша
 * версія фікса I1 рахувала `before` сирою сумою ВСЬОГО `rows`, тож
 * повернення на ЄДИНУ деактивовану точку хибно фліпало статус назад у
 * `in_stock` — детальніше й чому саме дві умови, а не одна, — коментар над
 * самим гвардом нижче.
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

  // Сума ДО повернення — із того самого заблокованого знімка, ЛИШЕ по
  // обслуговуючих точках (див. докблок вище).
  const before = servingQuantity(rows);

  await db
    .update(stockByPickupPoint)
    .set({
      quantity: row.quantity + line.quantity,
      updatedAt: new Date(),
    })
    .where(eq(stockByPickupPoint.id, row.id));

  // 🔴 Фліп назад — ЛИШЕ коли (а) точка ПОВЕРНЕННЯ сама ОБСЛУГОВУЄ
  // (`row.serving`) і (б) `before === 0`. Без (а): якщо точка деактивована,
  // `before` (сума по `serving`-рядках) — ПОРОЖНІЙ `reduce`, тобто 0
  // НЕЗАЛЕЖНО від реального стану, і без цього гварда статус хибно фліпнув
  // би в `in_stock`, хоча обслуговуючих точок з товаром і далі нуль (рівно
  // діра, знайдена повторним рев'ю) — кредит на необслуговуючу точку не
  // змінює видиму (read-side, майбутнє `reserveStock`) суму ВЗАГАЛІ. Коли ж
  // точка сама обслуговує, вона вже частина `before`, і нуль там — правдивий.
  // Арифметика `before + line.quantity > 0` тут ні до чого: `quantity`
  // позиції завжди ≥ 1 (`order_items_positive_quantity`, `schema.ts:258`) —
  // увесь сенс гварда саме в `row.serving`.
  if (row.serving && before === 0) {
    await setTargetStatus(db, line, 'in_stock');
  }
}
