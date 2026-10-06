/**
 * Прибирання кроку доставки К3-Е6а (`finally` у `./admin-shipping.mjs`) —
 * САМЕ в цьому порядку, бо кожен крок знімає перешкоду наступному:
 * (1) скасувати тестові замовлення — резерв повертається, `stock_reserved = 0`
 * (інакше точку не видалити: `pickup_point_has_stock`); (2) видалити SQL-ом
 * тестовий рядок залишку; (3) деактивувати й видалити точку, тариф і обидва
 * способи. Далі — зони й фінальні асерти (`./admin-shipping-final.mjs`);
 * послідовність складає `cleanupShippingStep` в `./admin-shipping.mjs`.
 *
 * 🔴 Стійкість до часткового стану: основна частина кроку могла впасти будь-де.
 * Тому КОЖНЕ скасування й КОЖНЕ видалення — у власному `try` і лише якщо запис
 * існує (перевірка SQL-ом). Відсутній запис пропускається з приміткою у факті,
 * а збій одного не зриває решту.
 */
import { orderItemsStock, orderState } from './sql.mjs';
import { pollOrder } from './admin-orders-buyer.mjs';
import {
  deleteStockRow,
  methodByCode,
  pointNameById,
  ratesOf,
  stockRowQty,
} from './admin-shipping-sql.mjs';
import { deactivateAndDelete, deleteRate } from './admin-shipping-owner.mjs';
import { leftovers } from './admin-shipping-final.mjs';

const STATUS_SELECT = 'select[aria-label="Статус замовлення"]';

/** Скасування власником у картці замовлення (як у кроці Е5); вже скасоване — no-op. */
async function cancelOrder(page, base, dbUrl, orderId) {
  const now = await orderState(dbUrl, orderId);
  if (now?.code === 'cancelled') return now;
  await page.goto(`${base}/admin/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
  await page.locator(STATUS_SELECT).selectOption({ label: 'Скасовано' });
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Скасувати замовлення' }).click();
  return pollOrder(dbUrl, orderId, 'cancelled');
}

/** (1) Кожне замовлення окремо: збій першого не лишає резерв другого. */
export async function cancelOrders({ page, base, dbUrl, check, st }) {
  const facts = [];
  let ok = st.orders.length === 2;
  for (const id of st.orders) {
    try {
      const s = await cancelOrder(page, base, dbUrl, id);
      const items = await orderItemsStock(dbUrl, id);
      ok &&=
        s?.code === 'cancelled' && items.every((i) => i.stock_reserved === 0);
      facts.push(`${s?.code}/${items.map((i) => i.stock_reserved).join(',')}`);
    } catch (e) {
      ok = false;
      facts.push(`${id.slice(0, 8)}: виняток ${e.message}`);
    }
  }
  const note = st.orders.length === 2 ? '' : ' (очікували 2)';
  check(
    'прибирання (1): тестові замовлення скасовано, stock_reserved = 0',
    ok,
    `замовлень ${st.orders.length}${note}: ${facts.join('; ')}`,
  );
}

/** (2) Рядок, якого крок не створив, — FAIL, а не порожній OK. */
export async function dropStockRow({ dbUrl, check, st }) {
  const label = 'прибирання (2): тестовий рядок залишку видалено SQL-ом';
  if (!st.stockRowId) {
    check(label, false, 'рядок залишку не створено — крок упав раніше');
    return;
  }
  try {
    const before = await stockRowQty(dbUrl, st.stockRowId);
    await deleteStockRow(dbUrl, st.stockRowId);
    const after = await stockRowQty(dbUrl, st.stockRowId);
    check(
      label,
      before !== null && after === null,
      `кількість до видалення ${before}, після — ${after}`,
    );
  } catch (e) {
    check(label, false, `виняток: ${e.message}`);
  }
}

/** (3) Точка → тариф → способи; кожен — лише якщо існує, у власному `try`. */
export async function dropShippingConfig({ page, base, dbUrl, check, fx, st }) {
  const del = (list, name, done) => () =>
    deactivateAndDelete(page, base, list, name, done);
  const methodStep = (m) => async () => {
    const row = await methodByCode(dbUrl, m.code);
    return row && del('methods', m.name, 'Службу видалено');
  };
  const steps = [
    [
      'точка',
      async () => {
        const name = st.point && (await pointNameById(dbUrl, st.point.id));
        return name && del('pickup-points', name, 'Точку видалено');
      },
    ],
    [
      'тариф',
      async () => {
        const m = await methodByCode(dbUrl, fx.pickup.code);
        const has = m && (await ratesOf(dbUrl, m.id)).length > 0;
        return has && (() => deleteRate(page, base, m.id, fx.rate.name));
      },
    ],
    [fx.pickup.name, methodStep(fx.pickup)],
    [fx.courier.name, methodStep(fx.courier)],
  ];
  const facts = [];
  let ok = true;
  for (const [what, prepare] of steps) {
    try {
      const run = await prepare();
      if (!run) {
        facts.push(`${what}: немає — пропущено`);
        continue;
      }
      const toast = await run();
      ok &&= toast;
      facts.push(`${what}: тост=${toast}`);
    } catch (e) {
      ok = false;
      facts.push(`${what}: виняток ${e.message}`);
    }
  }
  const left = await leftovers(
    dbUrl,
    [fx.pickup.code, fx.courier.code],
    [fx.point.name, fx.point.renamed],
  );
  check(
    "прибирання (3): точку, тариф, «Самовивіз Е6а» і «Кур'єр» деактивовано й видалено",
    ok && left.methods === 0 && left.points === 0,
    `${facts.join('; ')}; лишилось способів ${left.methods}, точок ${left.points}`,
  );
}
