/**
 * Реєстрація покупця тією самою формою, що й у продукції (`/auth`, вкладка
 * «Реєстрація») — окремим модулем, бо `funnel.mjs` із доказом М-12 («підсумок
 * = замовлення») переріс канон 150 рядків (передбачено брифом Task 14: перша
 * виноситься саме ця функція — вона самодостатня й ні від чого в воронці не
 * залежить).
 *
 * 🔴 Не декор: скасування замовлення живе за сесією (`cancelMyOrder` →
 * `withSessionDb`), а гість зі своїм `access_token` кабінету не має. Заодно
 * доводиться префіл чекауту з профілю (`auth/provision.ts`).
 */
import { randomUUID } from 'node:crypto';

const PASSWORD = 'live-smoke-2026';

/** @returns {Promise<string>} email нового покупця (для читабельності логів). */
export async function register(page, base) {
  const email = `live-smoke-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Реєстрація' }).click();
  await page.locator('#firstName').fill('Тест');
  await page.locator('#lastName').fill('Покупець');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(PASSWORD);
  await page.locator('#confirmPassword').fill(PASSWORD);
  await page.getByRole('button', { name: /Зареєструватися/ }).click();
  // Успішна реєстрація логінить і веде на головну (`Auth.tsx`).
  await page.waitForURL(`${base}/`, { timeout: 15_000 });
  return email;
}
