/**
 * Крок К3-Е5 — ЄДИНИЙ живий доказ замовлень в адмінці: покупець оформлює
 * ДВА замовлення, власник бачить їх у `/admin/orders`, підтверджує A і
 * скасовує B (через AlertDialog), а склад і кабінет покупця це бачать.
 * Доводить те, чого харнес не перетинає: справжню межу serverFn
 * `changeOrderStatus`, write-back колекції і повернення залишку з адмінки.
 *
 * Отримує залогінений context власника (`./owner-session.mjs`) і сторінку
 * покупця після воронки; відкриває ВЛАСНУ сторінку власника з власним
 * лічильником `pageerror`, контекст НЕ закриває. Бік покупця —
 * оформлення двох замовлень і перевірки кабінету/вітрини —
 * `./admin-orders-buyer.mjs` (канон 150 рядків).
 */
import { orderItemsStock, orderState, stockSnapshot } from './sql.mjs';
import { PRODUCT_SLUG, parseMoney } from './selectors.mjs';
import {
  placeTwoOrders,
  qty,
  pollOrder,
  verifyBadgeAfterCancel,
  verifyCabinet,
} from './admin-orders-buyer.mjs';

/** `aria-label` нативного `<select>` статусу — `admin.orders.statusSection`. */
const STATUS_SELECT = 'select[aria-label="Статус замовлення"]';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runAdminOrdersStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const buyerErrors = [];
  const onBuyerError = (e) => buyerErrors.push(String(e));
  buyerPage.on('pageerror', onBuyerError);
  const card = (id) =>
    page.goto(`${base}/admin/orders/${id}`, { waitUntil: 'networkidle' });
  try {
    // 1. Покупець оформлює два замовлення (A, B) повним шляхом.
    const { A, B, states, itemsA, itemsB, placedStock } = await placeTwoOrders({
      page: buyerPage,
      base,
      dbUrl,
      check,
    });

    // 2. Список: обидва — номер, сума = orders.total, бейдж статусу.
    await page.goto(`${base}/admin/orders`, { waitUntil: 'networkidle' });
    for (const [label, o, st] of [
      ['A', A, states[0]],
      ['B', B, states[1]],
    ]) {
      const row = page.locator('tr', { hasText: o.orderNumber });
      await row.waitFor({ timeout: 10_000 });
      const cells = row.locator('td');
      const amount = parseMoney(await cells.nth(2).textContent());
      const badge = ((await cells.nth(3).textContent()) ?? '').trim();
      check(
        `адмін: /admin/orders показує ${label} — номер, сума = orders.total, бейдж`,
        Math.abs(amount - st.total) < 0.01 && badge === st.name,
        `${o.orderNumber}: сума ${amount} vs ${st.total}, бейдж «${badge}» vs «${st.name}»`,
      );
    }

    // 3. A → «Підтверджено»: облік не чіпається; у кабінеті — без «Скасувати».
    await card(A.orderId);
    await page.locator(STATUS_SELECT).selectOption({ label: 'Підтверджено' });
    const stA = await pollOrder(dbUrl, A.orderId, 'confirmed');
    const afterA = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    const itemsA2 = await orderItemsStock(dbUrl, A.orderId);
    check(
      'адмін: A → «Підтверджено» — статус у БД, залишок і stock_reserved без змін',
      stA?.code === 'confirmed' &&
        same(afterA, placedStock) &&
        same(itemsA2, itemsA),
      `status ${stA?.code}, залишок ${placedStock.total} → ${afterA.total}`,
    );
    await verifyCabinet({ page: buyerPage, base, order: A, state: stA, check });

    // 4. B → «Скасовано» → AlertDialog → підтвердити: повернення рівно B.
    await card(B.orderId);
    await page.locator(STATUS_SELECT).selectOption({ label: 'Скасовано' });
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ timeout: 10_000 });
    const beforeConfirm = await orderState(dbUrl, B.orderId);
    await dialog.getByRole('button', { name: 'Скасувати замовлення' }).click();
    const stB = await pollOrder(dbUrl, B.orderId, 'cancelled');
    const afterB = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    const itemsB2 = await orderItemsStock(dbUrl, B.orderId);
    check(
      'адмін: B → «Скасовано» через діалог — cancelled, повернуто рівно кількість B, stock_reserved = 0',
      beforeConfirm?.code === 'new' &&
        stB?.code === 'cancelled' &&
        afterB.total === afterA.total + qty(itemsB) &&
        itemsB2.every((r) => r.stock_reserved === 0),
      `до підтвердження ${beforeConfirm?.code}; status ${stB?.code}; залишок ${afterA.total} → ${afterB.total} (B: ${qty(itemsB)}); stock_reserved ${itemsB2.map((r) => r.stock_reserved).join(',')}`,
    );
    await verifyBadgeAfterCancel({
      page: buyerPage,
      base,
      stock: afterB,
      check,
    });

    // 5. Картка B: контрол вимкнений; кабінет покупця: B «Скасовано».
    await card(B.orderId);
    const locked = await page
      .locator(`${STATUS_SELECT}:disabled`)
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'адмін: картка B — контрол статусу вимкнений',
      locked,
      String(locked),
    );
    await verifyCabinet({ page: buyerPage, base, order: B, state: stB, check });

    // 6. Нуль pageerror власника й покупця за весь крок.
    check(
      'адмін pageerror за весь крок замовлень',
      errors.length === 0,
      errors.length === 0 ? '0' : errors.join(' | '),
    );
    check(
      'покупець pageerror за весь крок замовлень',
      buyerErrors.length === 0,
      buyerErrors.length === 0 ? '0' : buyerErrors.join(' | '),
    );
  } finally {
    buyerPage.off('pageerror', onBuyerError);
    await page.close();
  }
}
