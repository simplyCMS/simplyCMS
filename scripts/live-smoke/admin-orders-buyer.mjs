/**
 * Бік покупця кроку замовлень К3-Е5 (`./admin-orders.mjs`) — окремим
 * модулем за каноном 150 рядків: оформлення двох замовлень, кабінет і
 * вітрина, які мусять побачити те, що власник зробив в адмінці, і
 * SQL-очікування, що дає діям адмінки час доїхати до БД.
 */
import { orderItemsStock, orderState, stockSnapshot } from './sql.mjs';
import { PRODUCT_SLUG, waitText } from './selectors.mjs';
import { badgeTextFor } from './stock-labels.mjs';
import {
  addToCart,
  openCheckoutPrefilled,
  submitCheckout,
} from './place-order.mjs';

/** Сумарна кількість позицій замовлення. */
export const qty = (items) => items.reduce((s, i) => s + i.quantity, 0);

/**
 * Покупець оформлює ДВА замовлення (A, B) повним шляхом — `addToCart` →
 * `/checkout` → префіл → `submitCheckout` — і SQL доводить: обидва `new`,
 * у позиціях `stock_reserved = кількість` і точка списання (Е5-4′),
 * залишок списано на обидва.
 */
export async function placeTwoOrders({ page, base, dbUrl, check }) {
  const before = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  const placed = [];
  for (let i = 0; i < 2; i++) {
    const target = { section: before.section, productSlug: PRODUCT_SLUG };
    await addToCart({ page, base, ...target });
    await openCheckoutPrefilled({ page, base });
    placed.push(await submitCheckout({ page, base, dbUrl }));
  }
  const [A, B] = placed;
  const states = await Promise.all(
    placed.map((o) => orderState(dbUrl, o.orderId)),
  );
  check(
    'замовлення: покупець оформив два, обидва new',
    states.every((s) => s?.code === 'new'),
    states.map((s) => s?.code).join(', '),
  );
  const itemsA = await orderItemsStock(dbUrl, A.orderId);
  const itemsB = await orderItemsStock(dbUrl, B.orderId);
  const all = [...itemsA, ...itemsB];
  check(
    'замовлення: у позиціях stock_reserved = кількість, stock_point_id заданий',
    all.length === 2 &&
      all.every(
        (r) => r.stock_reserved === r.quantity && r.stock_point_id !== null,
      ),
    JSON.stringify(all),
  );
  const placedStock = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  check(
    'замовлення: залишок списано на обидва',
    placedStock.total === before.total - qty(itemsA) - qty(itemsB),
    `${before.total} → ${placedStock.total}`,
  );
  return { A, B, states, itemsA, itemsB, placedStock };
}

/**
 * Чекає, доки статус замовлення в БД стане `code` (write-back в адмінці
 * асинхронний відносно `selectOption`/кліку). Повертає останній стан —
 * перевірка сама вирішує, чи дочекались.
 */
export async function pollOrder(dbUrl, orderId, code, timeout = 10_000) {
  const until = Date.now() + timeout;
  let state = await orderState(dbUrl, orderId);
  while (state?.code !== code && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 200));
    state = await orderState(dbUrl, orderId);
  }
  return state;
}

/**
 * Кабінет покупця `/profile/orders/<id>`: бейдж показує назву статусу з БД;
 * «Скасувати» (кнопка покупця, лише зі статусу `new`) відсутня — і для
 * підтвердженого A, і для скасованого B.
 */
export async function verifyCabinet({ page, base, order, state, check }) {
  await page.goto(`${base}/profile/orders/${order.orderId}`, {
    waitUntil: 'networkidle',
  });
  const shown = await waitText(page, state?.name ?? '—');
  const cancelButtons = await page
    .getByRole('button', { name: 'Скасувати', exact: true })
    .count();
  const label =
    state?.code === 'cancelled'
      ? 'кабінет: B показано «Скасовано», кнопки «Скасувати» немає'
      : 'кабінет: у підтвердженому A кнопки «Скасувати» немає';
  check(
    label,
    shown && cancelButtons === 0,
    `бейдж «${state?.name}» видно=${shown}, кнопок «Скасувати» ${cancelButtons}`,
  );
}

/** Вітрина після скасування адміном: бейдж наявності картки = БД. */
export async function verifyBadgeAfterCancel({ page, base, stock, check }) {
  await page.goto(`${base}/catalog/${stock.section}/${PRODUCT_SLUG}`, {
    waitUntil: 'networkidle',
  });
  const badge =
    (await page
      .locator('text=/В наявності|Немає в наявності|Під замовлення/')
      .first()
      .textContent()) ?? '';
  const expected = badgeTextFor(stock.status);
  check(
    'вітрина: після скасування адміном бейдж наявності = БД',
    badge.includes(expected) && badge.includes(String(stock.total)),
    `stock_status=${stock.status}, залишок ${stock.total}, бейдж «${badge.trim()}»`,
  );
}
