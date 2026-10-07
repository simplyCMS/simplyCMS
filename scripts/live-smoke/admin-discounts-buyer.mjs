/**
 * Бік покупця кроку знижок К3-Е6в (`./admin-discounts.mjs`) — окремим
 * модулем за каноном 150 рядків: читання ціни й порогових підказок зі
 * сторінки товару, кошик на 3 шт і оформлення. Лише браузер і розбір того,
 * що бачить покупець; очікування рахує оркестрація.
 *
 * 🔴 SSR віддає базову ціну до гідрації (Е6в-11), знижку рахує середовище
 * після неї. Тому кожне читання чекає ПОЗИТИВНИЙ сигнал (підказку, потрібну
 * ціну, рядок квоти), а «чогось немає» доводиться вікном очікування, а не
 * миттєвим знімком DOM, у якому середовище ще не встигло прийти.
 */
import { openCheckoutPrefilled, submitCheckout } from './place-order.mjs';
import { FIELD, parseMoney, waitText } from './selectors.mjs';

const PRICE_BLOCK = '[data-simplycms-requisite="product-detail.price-block"]';
const CART_ITEMS = '[data-simplycms-requisite="cart.items"]';
/** Корінь drawer-а кошика (`cart-ui/CartDrawer.tsx`): затемнення + панель справа. */
const CART_DRAWER = 'div.fixed.inset-0.z-50';

/** Знімок блоку ціни: ціна, закреслена база (якщо є) і рядки підказок. */
function readPriceBlock(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const spans = [...el.querySelectorAll(':scope > span')];
    return {
      price: spans[0]?.textContent ?? '',
      old: spans[1]?.textContent ?? '',
      hints: [...el.querySelectorAll('li')].map((li) => li.textContent ?? ''),
    };
  }, PRICE_BLOCK);
}

const toNumbers = (raw) =>
  raw && {
    price: parseMoney(raw.price),
    old: raw.old ? parseMoney(raw.old) : null,
    hints: raw.hints,
  };

/**
 * Сторінка товару і очікування стану `until(блок)` — до `timeout` мс.
 * Повертає ОСТАННІЙ знімок: перевірка сама вирішує, чи дочекались.
 */
export async function productPrice(page, url, until, timeout = 10_000) {
  await page.goto(url, { waitUntil: 'networkidle' });
  const deadline = Date.now() + timeout;
  let block = toNumbers(await readPriceBlock(page));
  while (!(block && until(block)) && Date.now() < deadline) {
    await page.waitForTimeout(250);
    block = toNumbers(await readPriceBlock(page));
  }
  return block;
}

/** Порожній кошик (ключ `cart-store`) → картка товару → «Додати в кошик» `times` разів. */
export async function putInCart(page, url, times) {
  await page.evaluate(() => localStorage.removeItem('simplycms-cart'));
  await page.goto(url, { waitUntil: 'networkidle' });
  const add = page.getByRole('button', { name: /Додати в кошик/ }).first();
  for (let i = 0; i < times; i++) {
    await add.click();
    if (!(await waitText(page, 'Додано в кошик')))
      throw new Error('[live-smoke] тост «Додано в кошик» не зʼявився');
    // Додавання відкриває drawer кошика (`useCart`: `setIsOpen(true)`), а його
    // оверлей перехоплює наступний клік. Drawer — власна розмітка `cart-ui`
    // без ролі й Escape: закриваємо кліком у затемнення, як покупець.
    const drawer = page.locator(CART_DRAWER);
    await drawer.waitFor({ timeout: 5_000 });
    await page.mouse.click(5, 5);
    await drawer.waitFor({ state: 'detached', timeout: 5_000 });
  }
}

/**
 * `/cart`: рядок квоти `<ціна> × <кількість>` — ціна за штуку з серверної
 * квоти (Е6в-13), і чи показано назву знижки `discountName`.
 */
export async function cartLine(page, base, quantity, discountName) {
  await page.goto(`${base}/cart`, { waitUntil: 'networkidle' });
  const items = page.locator(CART_ITEMS).first();
  const unit = items.getByText(new RegExp(`×\\s*${quantity}$`)).first();
  // Рядка «× N» немає — квота порахувала іншу кількість: це факт для
  // перевірки (`perUnit: null`), а не виняток, що зірвав би решту кроку.
  const shown = await unit
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const perUnit = shown
    ? parseMoney(((await unit.textContent()) ?? '').split('×')[0] ?? '')
    : null;
  const named = await items.getByText(discountName, { exact: true }).count();
  return { perUnit, named: named > 0 };
}

/** З кошика: `/checkout` → підсумок на екрані → підтвердження → `order-success`. */
export async function checkout(page, base, dbUrl) {
  await openCheckoutPrefilled({ page, base });
  await page.locator(FIELD.total).waitFor();
  const displayed = parseMoney(await page.locator(FIELD.total).textContent());
  const order = await submitCheckout({ page, base, dbUrl });
  return { ...order, displayed };
}
