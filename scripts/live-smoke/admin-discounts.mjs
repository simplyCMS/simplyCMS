/**
 * Крок К3-Е6в — ЄДИНИЙ живий доказ знижок і категорій покупців у реальному
 * браузері на production-збірці: власник створює вкладені групи, знижку
 * «від 3 шт», категорію «VIP» зі знижкою й автоправило; НОВИЙ покупець
 * бачить порогову підказку, ціну квоти в кошику й ту саму ціну в
 * `order_items`; вимкнений батько стримує активну дитину; друге замовлення
 * переводить покупця у «VIP», і картка показує нову ціну.
 *
 * Отримує залогінений context власника і сторінку покупця воронки; покупець
 * кроку — новий (`register`) у ВЛАСНОМУ context того самого браузера:
 * автоправило «2+ замовлення» рахує замовлення покупця, а в покупця воронки
 * їх уже кілька. Сторінка воронки лише доводить, що ціна VIP — персональна.
 * Кожна сторінка — зі своїм лічильником `pageerror`. Прибирає за собою
 * (`./admin-discounts-cleanup.mjs`); тестові замовлення лишаються. Іде
 * ПІСЛЯ доставки й ПЕРЕД кроком «система» (той лишається останнім).
 */
import { register } from './register.mjs';
import { stockSnapshot } from './sql.mjs';
import * as q from './admin-discounts-sql.mjs';
import { setupPart } from './admin-discounts-setup.mjs';
import {
  disablePart,
  thresholdPart,
  vipFlowPart,
} from './admin-discounts-flow.mjs';
import { cleanupDiscountsStep } from './admin-discounts-cleanup.mjs';

const FX = {
  slug: 'sonyachna-panel-550w-mono',
  sku: 'SP-550',
  hit: /550 Вт/,
  parent: 'Е6в поріг',
  child: 'Е6в поріг / дитина',
  vipGroup: 'Е6в VIP',
  threshold: {
    name: 'Від 3 шт −10%',
    value: 10,
    minQuantity: 3,
    condition: 'Мін. кількість',
  },
  vip: { name: 'VIP −15%', value: 15, condition: 'Категорія користувача' },
  category: { name: 'VIP Е6в', code: 'vip_e6v' },
  rule: {
    name: '2+ замовлення → VIP Е6в',
    from: 'Роздріб',
    field: 'Кількість замовлень',
    value: 2,
  },
  // Два замовлення по 3 шт, а демо тримає 3 шт товару.
  extraStock: 6,
};

/** Відсоткова знижка, округлена до копійки (рушій рахує центами, Е6в-9). */
const off = (price, percent) => Math.round(price * (100 - percent)) / 100;

/** Факти, від яких залежать частини: товар, ціни, новий покупець, фікстура. */
async function prepare({ bPage, base, dbUrl, st }) {
  const stock = await stockSnapshot(dbUrl, FX.slug);
  const { id, price: full } = await q.productPricing(dbUrl, FX.slug);
  st.productId = id;
  st.productUrl = `${base}/catalog/${stock.section}/${FX.slug}`;
  st.prices = {
    base: full,
    off10: off(full, FX.threshold.value),
    off15: off(full, FX.vip.value),
  };
  const email = await register(bPage, base);
  const profile = await q.profileByEmail(dbUrl, email);
  st.buyer = {
    email,
    userId: profile.user_id,
    categoryId: profile.category_id,
  };
  st.stock = await q.bumpStock(dbUrl, FX.slug, FX.extraStock);
}

export async function runAdminDiscountsStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const buyerContext = await context.browser().newContext();
  const bPage = await buyerContext.newPage();
  const errors = { admin: [], buyer: [], funnel: [] };
  page.on('pageerror', (e) => errors.admin.push(String(e)));
  bPage.on('pageerror', (e) => errors.buyer.push(String(e)));
  const onFunnelError = (e) => errors.funnel.push(String(e));
  buyerPage.on('pageerror', onFunnelError);
  const st = { orders: [], ids: {} };
  const args = {
    page,
    bPage,
    funnelPage: buyerPage,
    base,
    dbUrl,
    check,
    fx: FX,
    st,
  };
  try {
    await prepare(args);
    await setupPart(args);
    await thresholdPart(args);
    await disablePart(args);
    await vipFlowPart(args);
  } catch (e) {
    check('знижки: крок дійшов до кінця', false, `виняток: ${e.message}`);
  } finally {
    await cleanupDiscountsStep(args);
    buyerPage.off('pageerror', onFunnelError);
    await buyerContext.close();
    await page.close();
  }
  for (const [who, list] of [
    ['адмін', errors.admin],
    ['покупець кроку', errors.buyer],
    ['покупець воронки', errors.funnel],
  ])
    check(
      `${who}: pageerror за весь крок знижок`,
      list.length === 0,
      list.length === 0 ? '0' : list.join(' | '),
    );
}
