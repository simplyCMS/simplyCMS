/**
 * Бік покупця кроку К3-Е6г (`./admin-customers.mjs`) — окремим модулем за
 * каноном 150 рядків: сесія з погляду браузера покупця, вхід, вихід,
 * оформлення замовлення. Кожен покупець кроку — у власному `browser.newContext()`.
 */
import { PASSWORD } from './register.mjs';
import { stockSnapshot } from './sql.mjs';
import {
  addToCart,
  openCheckoutPrefilled,
  submitCheckout,
} from './place-order.mjs';
import { waitText } from './selectors.mjs';

/** Сесія очима сторінки: `null` — гість; інакше `{ user: { email } }`. */
export const sessionOf = (page) =>
  page.evaluate(() =>
    fetch('/api/auth/get-session', { credentials: 'include' }).then((r) =>
      r.text().then((t) => (t ? JSON.parse(t) : null)),
    ),
  );

/** Вихід тим самим POST, що й клієнт Better Auth (`/api/auth/sign-out`). */
export const signOut = (page) =>
  page.evaluate(() =>
    fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).then((r) => r.status),
  );

/** Форма входу `/auth`; повертає, що сталося: перехід на `/` чи текст відмови. */
export async function loginAs(page, base, email, failureText) {
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  if (failureText) return waitText(page, failureText);
  await page.waitForURL(`${base}/`, { timeout: 15_000 });
  return true;
}

/** Повна воронка одного товару: картка → кошик → чекаут → `order-success`. */
export async function placeOrder({ page, base, dbUrl, slug }) {
  const { section } = await stockSnapshot(dbUrl, slug);
  await page.evaluate(() => localStorage.removeItem('simplycms-cart'));
  await addToCart({ page, base, section, productSlug: slug });
  await openCheckoutPrefilled({ page, base });
  return submitCheckout({ page, dbUrl });
}
