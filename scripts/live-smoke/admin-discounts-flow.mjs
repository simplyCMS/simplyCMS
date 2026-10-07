/**
 * Сценарій покупця кроку знижок К3-Е6в (`./admin-discounts.mjs`) — окремим
 * модулем за каноном 150 рядків. Три доказові частини: (1) поріг «від 3 шт»
 * — підказка на картці, ціна квоти в кошику й те саме в `order_items`;
 * (2) вимкнений БАТЬКО стримує активну дитину — ні підказки, ні знижки;
 * (3) друге замовлення переводить покупця в «VIP» автоправилом, і картка
 * після перезавантаження показує ціну VIP, а покупець воронки — ні.
 */
import { pollUntil } from './admin-shipping-sql.mjs';
import * as q from './admin-discounts-sql.mjs';
import * as ui from './admin-discounts-owner.mjs';
import * as buyer from './admin-discounts-buyer.mjs';
import { parseMoney } from './selectors.mjs';

const cents = (n) => Math.round(n * 100);
const sameMoney = (a, b) => a !== null && b !== null && cents(a) === cents(b);
/** «від 3 шт — 5 310,00 ₴/шт (−10%)»: поріг, ціна на порозі й відсоток. */
const thresholdHint = (fx, price) => (h) =>
  h.startsWith(`від ${fx.threshold.minQuantity} шт — `) &&
  h.endsWith(`/шт (−${fx.threshold.value}%)`) &&
  sameMoney(parseMoney(h.split('—')[1]?.split('/шт')[0]), price);

/** (1) Поріг: картка → кошик 3 шт → замовлення з тією самою ціною. */
export async function thresholdPart({ bPage, base, dbUrl, check, fx, st }) {
  const { base: full, off10 } = st.prices;
  const block = await buyer.productPrice(bPage, st.productUrl, (b) =>
    b.hints.some(thresholdHint(fx, off10)),
  );
  check(
    'знижки: картка товару — ціна без знижки й підказка «від 3 шт — … (−10%)»',
    block !== null &&
      sameMoney(block.price, full) &&
      block.old === null &&
      block.hints.length === 1 &&
      thresholdHint(fx, off10)(block.hints[0]),
    `ціна ${block?.price} (база ${full}), підказки ${JSON.stringify(block?.hints)}`,
  );
  await buyer.putInCart(bPage, st.productUrl, 3);
  const line = await buyer.cartLine(bPage, base, 3, fx.threshold.name);
  check(
    'знижки: кошик 3 шт — ціна квоти −10% і назва знижки',
    sameMoney(line.perUnit, off10) && line.named,
    `за шт ${line.perUnit} (очікували ${off10}), назва «${fx.threshold.name}» видно=${line.named}`,
  );
  const order = await buyer.checkout(bPage, base, dbUrl);
  st.orders.push(order.orderId);
  const items = await q.orderItemsPricing(dbUrl, order.orderId);
  const applied = items[0]?.discount_data?.applied?.map((a) => a.name);
  const profile = await q.profileByEmail(dbUrl, st.buyer.email);
  check(
    'знижки: замовлення 1 — order_items.price = ціна з кошика, discount_data.applied рівно [«Від 3 шт −10%»], категорія ще не змінилась',
    items.length === 1 &&
      items[0].quantity === 3 &&
      sameMoney(items[0].price, line.perUnit) &&
      JSON.stringify(applied) === JSON.stringify([fx.threshold.name]) &&
      profile?.category_id === st.buyer.categoryId,
    `${JSON.stringify(items.map(({ quantity, price, base_price }) => ({ quantity, price, base_price })))}; applied ${JSON.stringify(applied)}; категорія ${profile?.category ?? profile?.category_id}`,
  );
}

/** (2) Власник вимикає БАТЬКІВСЬКУ групу; дочірня лишається активною. */
export async function disablePart({ page, bPage, base, dbUrl, check, fx, st }) {
  const toast = await ui.toggleGroup(page, base, fx.parent);
  const groups = await pollUntil(
    () => q.groupsByName(dbUrl, [fx.parent, fx.child]),
    (r) => r.some((g) => g.name === fx.parent && !g.is_active),
  );
  const active = Object.fromEntries(groups.map((g) => [g.name, g.is_active]));
  check(
    'знижки: власник вимкнув батьківську «Е6в поріг» перемикачем, дочірня лишилась активною',
    toast && active[fx.parent] === false && active[fx.child] === true,
    `тост ${toast}; ${JSON.stringify(active)}`,
  );
  // Вікно очікування: підказка, що зʼявилась би після гідрації, — FAIL.
  const block = await buyer.productPrice(
    bPage,
    st.productUrl,
    (b) => b.hints.length > 0,
    5_000,
  );
  check(
    'знижки: вимкнена батьківська група — на картці після перезавантаження підказки немає',
    block !== null &&
      block.hints.length === 0 &&
      sameMoney(block.price, st.prices.base),
    `ціна ${block?.price}, підказки ${JSON.stringify(block?.hints)}`,
  );
  await buyer.putInCart(bPage, st.productUrl, 3);
  const line = await buyer.cartLine(bPage, base, 3, fx.threshold.name);
  check(
    'знижки: вимкнена батьківська група — кошик 3 шт без знижки',
    sameMoney(line.perUnit, st.prices.base) && !line.named,
    `за шт ${line.perUnit} (база ${st.prices.base}), назва видно=${line.named}`,
  );
}

/** (3) Друге замовлення → автоправило → «VIP» → картка з ціною −15%. */
export async function vipFlowPart({
  bPage,
  funnelPage,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  const order = await buyer.checkout(bPage, base, dbUrl);
  st.orders.push(order.orderId);
  const items = await q.orderItemsPricing(dbUrl, order.orderId);
  const profile = await pollUntil(
    () => q.profileByEmail(dbUrl, st.buyer.email),
    (p) => p?.category_id === st.ids.category,
  );
  const history = await q.historyOf(dbUrl, st.buyer.userId);
  const last = history.at(-1);
  // Прибирання чекає рядок історії лише тоді, коли сценарій дійшов сюди.
  st.historyExpected = history.length;
  check(
    'знижки: замовлення 2 (без знижки) → profiles.category_id = «VIP Е6в», історія з rule_id правила й to_category_name',
    items.length === 1 &&
      sameMoney(items[0].price, st.prices.base) &&
      items[0].discount_data === null &&
      profile?.category_id === st.ids.category &&
      history.length === 1 &&
      last.rule_id === st.ids.rule &&
      last.to_category_id === st.ids.category &&
      last.to_category_name === fx.category.name,
    `ціна ${items[0]?.price}, discount_data ${JSON.stringify(items[0]?.discount_data)}; категорія ${profile?.category}; історія ${JSON.stringify(history)}`,
  );
  const { base: full, off15 } = st.prices;
  const vip = await buyer.productPrice(bPage, st.productUrl, (b) =>
    sameMoney(b.price, off15),
  );
  check(
    'знижки: зміна категорії → зміна ціни — картка після перезавантаження показує −15% і закреслену базу',
    vip !== null && sameMoney(vip.price, off15) && sameMoney(vip.old, full),
    `ціна ${vip?.price} (очікували ${off15}), закреслена ${vip?.old}`,
  );
  const other = await buyer.productPrice(
    funnelPage,
    st.productUrl,
    (b) => !sameMoney(b.price, full),
    5_000,
  );
  check(
    'знижки: покупець воронки (інша категорія) ціни VIP не бачить',
    other !== null && sameMoney(other.price, full) && other.old === null,
    `ціна ${other?.price}, закреслена ${other?.old}`,
  );
}
