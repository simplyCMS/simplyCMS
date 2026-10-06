/**
 * Прибирання кроку доставки К3-Е6а (`finally` у `./admin-shipping.mjs`) —
 * САМЕ в цьому порядку, бо кожен крок знімає перешкоду наступному:
 * (1) скасувати тестові замовлення — резерв повертається, `stock_reserved = 0`
 * (інакше точку не видалити: `pickup_point_has_stock`); (2) видалити SQL-ом
 * тестовий рядок залишку; (3) деактивувати й видалити точку, тариф і обидва
 * способи. Замовлення лишаються: посилання → NULL, знімок живий. Після
 * кроку демо знову має рівно одну активну точку й один спосіб самовивозу —
 * на цьому стоять воронка і `resolveStockPoint`. Кожен підкрок — у своєму
 * `try`: збій одного — рядок FAIL, а не зірване прибирання решти.
 */
import { orderItemsStock } from './sql.mjs';
import { pollOrder } from './admin-orders-buyer.mjs';
import {
  deleteStockRow,
  demoShippingShape,
  leftovers,
  orderShipping,
  pointNameById,
  stockRowQty,
} from './admin-shipping-sql.mjs';
import { deactivateAndDelete, deleteRate } from './admin-shipping-owner.mjs';

const STATUS_SELECT = 'select[aria-label="Статус замовлення"]';

async function guarded(check, label, fn) {
  try {
    await fn();
  } catch (e) {
    check(label, false, `виняток: ${e.message}`);
  }
}

/** Скасування власником у картці замовлення (як у кроці Е5). */
async function cancelOrder(page, base, dbUrl, orderId) {
  await page.goto(`${base}/admin/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
  await page.locator(STATUS_SELECT).selectOption({ label: 'Скасовано' });
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Скасувати замовлення' }).click();
  return pollOrder(dbUrl, orderId, 'cancelled');
}

export async function cleanupShippingStep({
  page,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  const L1 = 'прибирання (1): тестові замовлення скасовано, stock_reserved = 0';
  await guarded(check, L1, async () => {
    const facts = [];
    let ok = st.orders.length === 2;
    for (const id of st.orders) {
      const s = await cancelOrder(page, base, dbUrl, id);
      const items = await orderItemsStock(dbUrl, id);
      ok &&=
        s?.code === 'cancelled' && items.every((i) => i.stock_reserved === 0);
      facts.push(`${s?.code}/${items.map((i) => i.stock_reserved).join(',')}`);
    }
    check(L1, ok, `замовлень ${st.orders.length}: ${facts.join('; ')}`);
  });

  const L2 = 'прибирання (2): тестовий рядок залишку видалено SQL-ом';
  await guarded(check, L2, async () => {
    const before = await stockRowQty(dbUrl, st.stockRowId);
    if (st.stockRowId) await deleteStockRow(dbUrl, st.stockRowId);
    const after = await stockRowQty(dbUrl, st.stockRowId);
    check(
      L2,
      after === null,
      `кількість до видалення ${before}, після — ${after}`,
    );
  });

  const L3 =
    "прибирання (3): точку, тариф, «Самовивіз Е6а» і «Кур'єр» деактивовано й видалено";
  await guarded(check, L3, async () => {
    const toasts = [];
    const pointName = st.point && (await pointNameById(dbUrl, st.point.id));
    if (pointName)
      toasts.push(
        await deactivateAndDelete(
          page,
          base,
          'pickup-points',
          pointName,
          'Точку видалено',
        ),
      );
    if (st.pickup)
      toasts.push(await deleteRate(page, base, st.pickup.id, fx.rate.name));
    for (const m of [fx.pickup, fx.courier])
      toasts.push(
        await deactivateAndDelete(
          page,
          base,
          'methods',
          m.name,
          'Службу видалено',
        ),
      );
    const left = await leftovers(
      dbUrl,
      [fx.pickup.code, fx.courier.code],
      [fx.point.name, fx.point.renamed],
    );
    check(
      L3,
      toasts.length === 4 &&
        toasts.every(Boolean) &&
        left.methods === 0 &&
        left.points === 0,
      `тости ${toasts.join(',')}; лишилось способів ${left.methods}, точок ${left.points}`,
    );
  });

  await guarded(check, 'прибирання: стан демо', async () => {
    const rows = await Promise.all(
      st.orders.map((id) => orderShipping(dbUrl, id)),
    );
    check(
      'прибирання: замовлення лишились — pickup_point_id і shipping_method_id = NULL, знімок живий',
      rows.length === 2 &&
        rows.every(
          (r) =>
            r && r.pickup_point_id === null && r.shipping_method_id === null,
        ) &&
        rows[1]?.shipping_data?.destination?.name === fx.point.name,
      rows
        .map(
          (r) =>
            `${r?.shipping_data?.methodName} / ${r?.shipping_data?.destination?.name ?? r?.shipping_data?.destination?.city}`,
        )
        .join('; '),
    );
    const shape = await demoShippingShape(dbUrl);
    check(
      'прибирання: демо знову має рівно одну активну точку (системну) і один спосіб самовивозу',
      shape.points.length === 1 &&
        shape.points[0].is_system === true &&
        shape.pickupMethods === 1,
      `активних точок ${shape.points.length}, is_system ${shape.points.map((p) => p.is_system).join(',')}; способів самовивозу ${shape.pickupMethods}`,
    );
  });
}
