/**
 * Крок К3-Е5б — ЄДИНИЙ живий доказ редагування позицій замовлення через
 * справжню межу serverFn і write-back колекцій: кількість +1, додавання
 * іншого товару пошуком, видалення; склад, суми й кабінет узгоджені, а
 * скасування покупцем повертає рівно актуально списане (Review Focus 2).
 * Дії — `./admin-order-edit-ui.mjs`, SQL — `./admin-order-edit-sql.mjs`.
 */
import { stockSnapshot } from './sql.mjs';
import { PRODUCT_SLUG } from './selectors.mjs';
import { pollOrder } from './admin-orders-buyer.mjs';
import {
  addBySearch,
  buyerCancel,
  cabinetTotal,
  openCard,
  placeOrder,
  removeItem,
  setQuantity,
  trackErrors,
} from './admin-order-edit-ui.mjs';
import {
  cents,
  defaultPrice,
  orderFormula,
  orderItems,
  orderSums,
  pollItems,
  sumsFormula,
} from './admin-order-edit-sql.mjs';

/** Другий товар демо з обліком залишку (демо-сід: 3 шт на складі). */
const ADDED_SLUG = 'sonyachna-panel-550w-mono';
/** Запит пошуку — артикул (Е5б-4: `ilike` за name і sku) і назва в результаті. */
const ADDED_QUERY = 'SP-550';
const ADDED_HIT = /550 Вт/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runAdminOrderEditStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const admin = trackErrors(page);
  const buyer = trackErrors(buyerPage);
  try {
    // 1. Покупець оформлює замовлення; знімки обох товарів — ДО нього.
    const before = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    const beforeAdded = await stockSnapshot(dbUrl, ADDED_SLUG);
    const section = before.section;
    const { orderId } = await placeOrder({
      page: buyerPage,
      base,
      dbUrl,
      section,
    });
    const [line] = await orderItems(dbUrl, orderId);
    const placed = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    check(
      'редагування: замовлення оформлено — одна позиція, stock_reserved = 1',
      line?.quantity === 1 && line.stock_reserved === 1,
      `${JSON.stringify(line)}; залишок ${before.total} → ${placed.total}`,
    );

    // 2. Власник: кількість 1 → 2 (Enter) — облік, залишок −1, суми.
    await openCard({ page, base, orderId });
    await setQuantity({ page, name: line.name, quantity: 2 });
    const inc = await pollItems(dbUrl, orderId, (r) => r[0]?.quantity === 2);
    const incStock = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    const incSums = await orderFormula(dbUrl, orderId, inc);
    check(
      'редагування: кількість 1 → 2 — stock_reserved 2, залишок −1, суми = формула',
      inc[0]?.stock_reserved === 2 &&
        incStock.total === placed.total - 1 &&
        incSums.ok,
      `залишок ${placed.total} → ${incStock.total}; ${incSums.fact}`,
    );

    // 3. Додає ІНШИЙ товар пошуком: ціна рушія, залишок його точки −1.
    const addedBefore = await stockSnapshot(dbUrl, ADDED_SLUG);
    await addBySearch({ page, query: ADDED_QUERY, hit: ADDED_HIT });
    const add = await pollItems(dbUrl, orderId, (r) => r.length === 2);
    const added = add.find((r) => r.slug === ADDED_SLUG);
    const addedStock = await stockSnapshot(dbUrl, ADDED_SLUG);
    const price = await defaultPrice(dbUrl, ADDED_SLUG);
    const addSums = await orderFormula(dbUrl, orderId, add);
    check(
      'редагування: додано 550 Вт пошуком — ціна рушія, stock_reserved 1, залишок його точки −1, суми = формула',
      added !== undefined &&
        cents(added.price) === cents(price) &&
        added.quantity === 1 &&
        added.stock_reserved === 1 &&
        added.stock_point_id !== null &&
        addedStock.total === addedBefore.total - 1 &&
        addSums.ok,
      `ціна ${added?.price} vs ${price}; залишок ${JSON.stringify(addedBefore.byPoint)} → ${JSON.stringify(addedStock.byPoint)}; ${addSums.fact}`,
    );

    // 4. Видаляє її через AlertDialog: позиції немає, залишок повернуто.
    await removeItem({ page, name: added?.name });
    const rem = await pollItems(dbUrl, orderId, (r) => r.length === 1);
    const remStock = await stockSnapshot(dbUrl, ADDED_SLUG);
    const sums = await orderSums(dbUrl, orderId);
    const remSums = sumsFormula(rem, sums);
    check(
      'редагування: 550 Вт видалено — позиції немає, залишок його точки повернуто, суми = формула',
      rem.every((r) => r.slug !== ADDED_SLUG) &&
        same(remStock, addedBefore) &&
        remSums.ok,
      `залишок ${addedStock.total} → ${remStock.total}; ${remSums.fact}`,
    );

    // 5. Кабінет покупця показує НОВИЙ total.
    const shown = await cabinetTotal({ page: buyerPage, base, orderId });
    check(
      'кабінет: після редагування «Разом» = orders.total',
      Math.round(shown * 100) === cents(sums.total),
      `кабінет ${shown}, orders.total ${sums.total}`,
    );

    // 6. Покупець скасовує: залишки = стан ДО замовлення (Review Focus 2).
    await buyerCancel({ page: buyerPage, base, orderId });
    const st = await pollOrder(dbUrl, orderId, 'cancelled');
    const after = await stockSnapshot(dbUrl, PRODUCT_SLUG);
    const afterAdded = await stockSnapshot(dbUrl, ADDED_SLUG);
    const final = await orderItems(dbUrl, orderId);
    check(
      'редагування: покупець скасував — залишки = стан до замовлення, stock_reserved = 0',
      st?.code === 'cancelled' &&
        same(after, before) &&
        same(afterAdded, beforeAdded) &&
        final.every((r) => r.stock_reserved === 0),
      `status ${st?.code}; 450 Вт ${before.total} → ${after.total}; 550 Вт ${beforeAdded.total} → ${afterAdded.total}`,
    );

    // 7. Нуль pageerror власника й покупця за весь крок.
    admin.report(check, 'адмін pageerror за весь крок редагування');
    buyer.report(check, 'покупець pageerror за весь крок редагування');
  } finally {
    buyer.stop();
    await page.close();
  }
}
