/**
 * Крок К3-Е6а — ЄДИНИЙ живий доказ доставки «провайдер + режим ціни»:
 * власник доводить setDefault зони, створює «Самовивіз Е6а» (`core:pickup`,
 * `rates`) з тарифом і точкою та «Кур'єр» (`core:address`, `carrier`),
 * відмови видалення приходять тостом 409; покупець оформлює обома способами,
 * а знімок доставки переживає перейменування точки.
 *
 * Отримує залогінений context власника і сторінку покупця після воронки;
 * відкриває ВЛАСНУ сторінку з лічильником `pageerror`, контекст не закриває.
 * Іде ОСТАННІМ у сесії власника і прибирає за собою (`./admin-shipping-cleanup.mjs`):
 * воронка й `resolveStockPoint` покладаються на рівно одну активну точку демо.
 * Дії браузера — `./admin-shipping-owner.mjs`, покупець —
 * `./admin-shipping-buyer.mjs`, замовлення — `./admin-shipping-orders.mjs`.
 */
import * as sqlx from './admin-shipping-sql.mjs';
import {
  courierPart,
  pickupPart,
  renamePart,
} from './admin-shipping-orders.mjs';
import {
  createPart,
  refusalPart,
  zoneDefaultPart,
} from './admin-shipping-setup.mjs';
import {
  cancelOrders,
  dropShippingConfig,
  dropStockRow,
} from './admin-shipping-cleanup.mjs';
import { assertDemoShape, restoreZones } from './admin-shipping-final.mjs';

const FX = {
  slug: sqlx.SHIPPING_PRODUCT_SLUG,
  zone: 'Е6а-тест',
  pickup: {
    name: 'Самовивіз Е6а',
    code: 'pickup_e6a',
    providerLabel: 'Самовивіз',
    sortOrder: 10,
  },
  courier: {
    name: "Кур'єр",
    code: 'courier_e6a',
    providerLabel: 'Доставка за адресою',
    pricingLabel: 'За тарифами перевізника',
    sortOrder: 20,
  },
  rate: { zone: 'Україна', name: 'Самовивіз Е6а — тариф', baseCost: '50' },
  // Нова назва не містить старої: `getByText` шукає підрядок.
  point: {
    name: 'Точка Е6а',
    renamed: 'Пункт видачі нова назва',
    city: 'Львів',
    address: 'вул. Тестова, 6',
  },
};

/**
 * Прибирання в каноні (1) замовлення → (2) рядок залишку → (3) точка, тариф,
 * способи; далі зони (ідемпотентно) і фінальні асерти стану демо.
 */
async function cleanupShippingStep(args) {
  await cancelOrders(args);
  await dropStockRow(args);
  await dropShippingConfig(args);
  await restoreZones(args);
  try {
    await assertDemoShape(args);
  } catch (e) {
    args.check('прибирання: стан демо', false, `виняток: ${e.message}`);
  }
}

export async function runAdminShippingStep({
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
  const st = { orders: [], stockRowId: null };
  const args = { page, buyerPage, base, dbUrl, check, fx: FX, st };
  try {
    // setDefault — ДО замовлень: тариф самовивозу живе в зоні «Україна».
    await zoneDefaultPart(args);
    await createPart(args);
    await refusalPart(args);
    await courierPart(args);
    await pickupPart(args);
    await renamePart(args);
  } catch (e) {
    check('доставка: крок дійшов до кінця', false, `виняток: ${e.message}`);
  } finally {
    await cleanupShippingStep(args);
    buyerPage.off('pageerror', onBuyerError);
    await page.close();
  }
  check(
    'адмін pageerror за весь крок доставки',
    errors.length === 0,
    errors.length === 0 ? '0' : errors.join(' | '),
  );
  check(
    'покупець pageerror за весь крок доставки',
    buyerErrors.length === 0,
    buyerErrors.length === 0 ? '0' : buyerErrors.join(' | '),
  );
}
