/**
 * Два вузькі хелпери оформлення замовлення покупцем (К3-Е5, ред.3 плану —
 * аудит Codex major 5): НЕ «наскрізна» функція, бо воронка (`./funnel.mjs`)
 * між кошиком і підтвердженням робить власні перевірки (непорожній кошик на
 * трьох сторінках, префіл, точка видачі, підсумок М-12), і вони мусять
 * лишитися на своїх місцях. Тому воронка бере звідси лише `submitCheckout`,
 * а крок замовлень адмінки (`./admin-orders.mjs`) складає повний шлях сам:
 * `addToCart` → `openCheckoutPrefilled` → `submitCheckout`.
 */
import { orderIdByNumber } from './sql.mjs';
import { FIELD, waitText } from './selectors.mjs';

/**
 * Картка товару → «Додати в кошик». Чекаємо тост `product.addedToCart`:
 * без нього наступний `goto` міг би обігнати запис кошика.
 * `section` — slug розділу: URL картки вітрини — `/catalog/<розділ>/<товар>`.
 */
export async function addToCart({ page, base, section, productSlug }) {
  await page.goto(`${base}/catalog/${section}/${productSlug}`, {
    waitUntil: 'networkidle',
  });
  await page
    .getByRole('button', { name: /Додати в кошик/ })
    .first()
    .click();
  if (!(await waitText(page, 'Додано в кошик')))
    throw new Error('[live-smoke] тост «Додано в кошик» не зʼявився');
}

/**
 * `/checkout` і очікування префілу профілем — той самий `waitForFunction`,
 * що у воронці: `getProfileSettings` заповнює форму в `useEffect`, тож
 * `fill` до нього був би затертий. 🔴 `?? ''`, а не `?.value !== ''`: до
 * рендеру форми `?.value` — `undefined`, і чекання виродилось би в no-op.
 */
export async function openCheckoutPrefilled({ page, base }) {
  await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    (sel) => (document.querySelector(sel)?.value ?? '') !== '',
    FIELD.firstName,
  );
}

/**
 * З УЖЕ відкритого `/checkout` після префілу: телефон → «Підтвердити
 * замовлення» → `order-success`. Номер читається з `order-success` (те, що
 * бачить покупець), id — SQL за номером (джерело правди — БД, не URL).
 */
export async function submitCheckout({ page, dbUrl }) {
  await page.locator(FIELD.phone).fill('+380501234567');
  await page.getByRole('button', { name: /Підтвердити замовлення/ }).click();
  await page.waitForURL(/\/order-success\//, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  // Номер — сусідній `<p>` під підписом `checkout.success.orderNumber`.
  const numberEl = page
    .getByText('Номер замовлення', { exact: true })
    .locator('xpath=following-sibling::p[1]');
  const orderNumber = ((await numberEl.textContent()) ?? '').trim();
  if (!orderNumber)
    throw new Error('[live-smoke] order-success не показав номер замовлення');
  const orderId = await orderIdByNumber(dbUrl, orderNumber);
  if (!orderId)
    throw new Error(`[live-smoke] у БД немає замовлення «${orderNumber}»`);
  return { orderId, orderNumber };
}
