/**
 * Підкрок 3 кроку «система» К3-Е6б (`./admin-system.mjs`): перемикач
 * «списувати залишок» на сторінці «Налаштування» (зберігається одразу,
 * Е6б-21). Окремим модулем за каноном 150 рядків. Очікує вже відкриту
 * `/admin/settings` у вкладці власника.
 */
import { orderItemsStock, stockSnapshot } from './sql.mjs';
import { PRODUCT_SLUG } from './selectors.mjs';
import { pollUntil } from './admin-shipping-sql.mjs';
import {
  addToCart,
  openCheckoutPrefilled,
  submitCheckout,
} from './place-order.mjs';
import * as q from './admin-system-sql.mjs';

/** 3. Склад вимкнено → замовлення не списує залишок; потім увімкнути назад. */
export async function stockPart({ page, buyerPage, base, dbUrl, check }) {
  const toggle = page.locator('#decrease_on_order');
  await toggle.click();
  const off = await pollUntil(
    () => q.decreaseOnOrder(dbUrl),
    (v) => v === false,
  );
  const before = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  await addToCart({
    page: buyerPage,
    base,
    section: before.section,
    productSlug: PRODUCT_SLUG,
  });
  await openCheckoutPrefilled({ page: buyerPage, base });
  const order = await submitCheckout({ page: buyerPage, base, dbUrl });
  const after = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  const items = await orderItemsStock(dbUrl, order.orderId);
  check(
    'система: облік вимкнено — замовлення не змінило залишок',
    off === false &&
      after.total === before.total &&
      items.length > 0 &&
      items.every((i) => i.stock_reserved === 0),
    `decrease_on_order=${off}, ${before.total} → ${after.total}, ${JSON.stringify(items)}`,
  );
  await toggle.click();
  const on = await pollUntil(
    () => q.decreaseOnOrder(dbUrl),
    (v) => v === true,
  );
  check(
    'система: облік увімкнено назад',
    on === true,
    `decrease_on_order=${on}`,
  );
}
