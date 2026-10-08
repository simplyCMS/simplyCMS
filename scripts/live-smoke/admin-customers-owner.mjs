/**
 * Дії власника в адмінці покупців К3-Е6г для кроку `./admin-customers.mjs` —
 * окремим модулем за каноном 150 рядків. Лише браузер: факти БД перевіряє
 * оркестрація (`./admin-customers-sql.mjs`).
 *
 * 🔴 Картка покупця — клієнтський роут (`ssr: false`), тож перед кліком чекаємо
 * мережеву тишу; перемикач ролі — Radix `Switch` (`role=switch`), а діалог
 * видалення — `alertdialog`, діалог бану — `dialog`.
 */
import { waitText } from './selectors.mjs';
import { pickOption } from './admin-shipping-owner.mjs';

const card = (page, base, userId) =>
  page.goto(`${base}/admin/users/${userId}`, { waitUntil: 'networkidle' });

/** Список → пошук за email → клік по покупцю → URL картки. */
export async function openFromList(page, base, email) {
  await page.goto(`${base}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Пошук за email/).fill(email);
  // Посилання несе імʼя покупця, а email — окремий рядок у тій самій клітинці.
  const row = page.getByRole('row').filter({ hasText: email });
  await row.first().waitFor({ timeout: 10_000 });
  const found = await row.count();
  await row.first().getByRole('link').click();
  await page.waitForURL(/\/admin\/users\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  await page.locator('#cc-email').waitFor({ timeout: 10_000 });
  return { found, url: page.url() };
}

/** Контакти на відкритій картці: імʼя й email → «Зберегти». */
export async function saveContacts(page, { firstName, email }) {
  await page.locator('#cc-first').fill(firstName);
  await page.locator('#cc-email').fill(email);
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  return waitText(page, 'Контакти збережено');
}

/** Категорія вручну: вибір, закріплення, причина → «Призначити». */
export async function pinCategory(page, base, userId, name) {
  await card(page, base, userId);
  await pickOption(page, 'cc-category', name);
  await page.locator('#cc-lock').click();
  await page.locator('#cc-reason').fill('Е6г: закріплено вручну');
  await page.getByRole('button', { name: 'Призначити', exact: true }).click();
  return waitText(page, 'Категорію змінено');
}

/** Перемикач «Доступ до адмін-панелі» на картці; чекає тост відповідної дії. */
export async function toggleAdmin(page, base, userId, grant) {
  await card(page, base, userId);
  await page.locator('#access-admin').click();
  return waitText(
    page,
    grant ? 'Адміністратора призначено' : 'Роль адміністратора знято',
  );
}

/** Бан з картки: діалог → причина → «Підтвердити блокування». */
export async function banFromCard(page, base, userId, reason) {
  await card(page, base, userId);
  await page.getByRole('button', { name: 'Заблокувати', exact: true }).click();
  await page.locator('#ban-reason').fill(reason);
  await page.getByRole('button', { name: 'Підтвердити блокування' }).click();
  return waitText(page, 'Покупця заблоковано');
}

/** Видалення акаунта: кнопка → введений email → «Видалити назавжди». */
export async function deleteFromCard(page, base, userId, email) {
  await card(page, base, userId);
  await page.getByRole('button', { name: 'Видалити акаунт' }).click();
  const dialog = page.getByRole('alertdialog');
  const confirm = dialog.getByRole('button', { name: 'Видалити назавжди' });
  const disabledBefore = await confirm.isDisabled();
  await page.locator('#delete-email').fill(email);
  await confirm.click();
  return { disabledBefore, toast: await waitText(page, 'Акаунт видалено') };
}
