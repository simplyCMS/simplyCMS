/**
 * Дії власника в адмінці знижок і категорій покупців для кроку К3-Е6в
 * (`./admin-discounts.mjs`) — окремим модулем за каноном 150 рядків. Лише
 * браузер: факти БД перевіряє оркестрація (`./admin-discounts-sql.mjs`).
 *
 * 🔴 Select-и форм — Radix (`SelectField`), не нативні: тригер за `id`, далі
 * опція за роллю (`pickOption` кроку доставки). Назва дочірньої групи має
 * батьківську префіксом — підписи кнопок дерева шукаються `exact`.
 */
import { waitText } from './selectors.mjs';
import { pickOption } from './admin-shipping-owner.mjs';

const go = (page, base, path) =>
  page.goto(`${base}/admin/${path}`, { waitUntil: 'networkidle' });

/** Нова група (`and` за замовчуванням); `parentId` — підгрупа з `?parentId`. */
export async function createGroup(page, base, name, parentId) {
  const query = parentId ? `?parentId=${parentId}` : '';
  await go(page, base, `discounts/groups/new${query}`);
  await page.locator('#dg-name').fill(name);
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  return waitText(page, 'Групу створено');
}

/**
 * Нова знижка в групі `groupId`: відсоток `value`, «усі типи цін» (дефолт
 * форми), ціль — товар пошуком за артикулом, далі одна умова: `min_quantity`
 * (`>=` — дефолт рядка) або `user_category` (кнопка-перемикач категорії).
 */
export async function createDiscount(page, base, d) {
  await go(page, base, `discounts/new?groupId=${d.groupId}`);
  await page.locator('#dc-name').fill(d.name);
  await page.locator('#dc-value').fill(String(d.value));
  await page
    .getByRole('button', { name: 'Додати товар або модифікацію' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Пошук за назвою або артикулом...').fill(d.sku);
  await dialog.getByRole('button', { name: d.hit }).first().click();
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
  await page.getByRole('combobox').filter({ hasText: 'Додати умову' }).click();
  await page.getByRole('option', { name: d.condition, exact: true }).click();
  if (d.minQuantity !== undefined)
    await page
      .locator('input[aria-label="Значення"]')
      .fill(String(d.minQuantity));
  if (d.category)
    await page.getByRole('button', { name: d.category, exact: true }).click();
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  return waitText(page, 'Скидку створено');
}

/** Нова категорія покупців (тип ціни — «за замовчуванням»). */
export async function createCategory(page, base, name, code) {
  await go(page, base, 'user-categories/new');
  await page.locator('#uc-name').fill(name);
  await page.locator('#uc-code').fill(code);
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  return waitText(page, 'Категорію створено');
}

/** Нове правило «з → в» з однією числовою умовою (`>=` — перший оператор поля). */
export async function createRule(page, base, r) {
  await go(page, base, 'user-categories/rules/new');
  await page.locator('#cr-name').fill(r.name);
  await pickOption(page, 'cr-from', r.from);
  await pickOption(page, 'cr-to', r.to);
  await page.getByRole('button', { name: 'Додати умову' }).click();
  await page.getByRole('combobox', { name: 'Поле' }).click();
  await page.getByRole('option', { name: r.field, exact: true }).click();
  await page.locator('input[aria-label="Значення"]').fill(String(r.value));
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  return waitText(page, 'Правило створено');
}

/** Перемикач активності групи в дереві; чекає тост операції. */
export async function toggleGroup(page, base, name) {
  await go(page, base, 'discounts');
  await page
    .getByRole('switch', { name: `Активність групи «${name}»`, exact: true })
    .click();
  return waitText(page, 'Статус оновлено');
}

/** Видалення групи з дерева: діалог з каскадом → «Видалити»; текст діалогу — у факт. */
export async function deleteGroup(page, base, name) {
  await go(page, base, 'discounts');
  await page
    .getByRole('button', { name: `Видалити групу «${name}»`, exact: true })
    .click();
  const dialog = page.getByRole('alertdialog');
  const warning = (await dialog.textContent()) ?? '';
  await dialog.getByRole('button', { name: 'Видалити', exact: true }).click();
  const toast = await waitText(page, 'Групу видалено');
  return { toast, cascade: warning.match(/груп: \d+, знижок: \d+/)?.[0] };
}

/** Видалення з картки (правило чи категорія): кошик у шапці → «Видалити». */
export async function deleteFromCard(page, base, path, toastText) {
  await go(page, base, path);
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити', exact: true })
    .click();
  return waitText(page, toastText);
}
