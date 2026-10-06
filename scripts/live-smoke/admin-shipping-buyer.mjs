/**
 * Бік покупця кроку доставки К3-Е6а (`./admin-shipping.mjs`) — окремим
 * модулем за каноном 150 рядків: оформлення «Кур'єром» (режим `carrier`) і
 * самовивозом на нову точку. Повний шлях хелперами Е5 (`addToCart` →
 * `openCheckoutPrefilled` → `submitCheckout`), між ними — вибір способу
 * кліком, як це робить покупець, а не підстановкою id у форму.
 */
import {
  addToCart,
  openCheckoutPrefilled,
  submitCheckout,
} from './place-order.mjs';
import { FIELD, parseMoney, waitText } from './selectors.mjs';

const CARRIER = 'За тарифами перевізника';

/** Радіо способу доставки — `label[for]` картки способу в чекауті. */
const chooseMethod = (page, methodId) =>
  page.locator(`label[for="checkout-shipping-${methodId}"]`).click();

/** Кошик → `/checkout` із префілом профілю. */
async function openWith(page, base, stock, slug) {
  await addToCart({ page, base, section: stock.section, productSlug: slug });
  await openCheckoutPrefilled({ page, base });
}

/**
 * «Кур'єр»: адресний спосіб із `carrier`. Місто й адреса — обовʼязкові для
 * адресного провайдера. Підсумок квоти (Е6а-18) мусить показати підпис
 * режиму, а не «Безкоштовно»: у DOM тоді два входження — картка способу й
 * рядок «Доставка» підсумку. `displayed` — ліве плече «показане = записане».
 */
export async function placeCourierOrder({ page, base, dbUrl, stock, slug, m }) {
  await openWith(page, base, stock, slug);
  await chooseMethod(page, m.id);
  await page.locator('#checkout-city').fill('Київ');
  await page.locator('#checkout-address').fill("вул. Кур'єрська, 7");
  const summaryCarrier = await page
    .waitForFunction(
      (text) =>
        [...document.querySelectorAll('span, div')].filter(
          (el) => el.childElementCount === 0 && el.textContent === text,
        ).length >= 2,
      CARRIER,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false);
  await page.locator(FIELD.total).waitFor();
  const displayed = parseMoney(await page.locator(FIELD.total).textContent());
  const order = await submitCheckout({ page, base, dbUrl });
  return { ...order, summaryCarrier, displayed };
}

/**
 * Самовивіз «Самовивіз Е6а» на нову точку: точку обирає покупець (способів
 * самовивозу два, точка цього способу одна — підставиться сама, але явний
 * вибір не залежить від автовибору). `successShowsPoint` — `order-success`
 * показує назву точки зі знімка.
 */
export async function placePickupOrder({
  page,
  base,
  dbUrl,
  stock,
  slug,
  m,
  point,
}) {
  await openWith(page, base, stock, slug);
  await chooseMethod(page, m.id);
  await page.locator(FIELD.pickupPoint).selectOption(point.id);
  await page.locator(FIELD.total).waitFor();
  await page.waitForLoadState('networkidle');
  const order = await submitCheckout({ page, base, dbUrl });
  const successShowsPoint = await waitText(page, point.name);
  return { ...order, successShowsPoint };
}

/**
 * Кабінет покупця після перейменування точки: показано назву зі знімка
 * (`oldName`), а поточної назви точки (`newName`) немає.
 */
export async function cabinetShowsSnapshot({
  page,
  base,
  orderId,
  oldName,
  newName,
}) {
  await page.goto(`${base}/profile/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
  const old = await waitText(page, oldName);
  const fresh = await page.getByText(newName).count();
  return { old, fresh };
}
