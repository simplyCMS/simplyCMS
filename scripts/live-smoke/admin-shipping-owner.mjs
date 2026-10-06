/**
 * Дії власника в адмінці доставки для кроку К3-Е6а (`./admin-shipping.mjs`)
 * — окремим модулем за каноном 150 рядків. Лише браузер: факти БД
 * перевіряє оркестрація кроку (`./admin-shipping-sql.mjs`).
 *
 * 🔴 Select форм доставки — Radix (`SelectField`), не нативний: тригер за
 * `id`, далі опція за роллю. `exact`, бо «Самовивіз» — префікс «Самовивіз Е6а».
 */
import { waitText } from './selectors.mjs';

const go = (page, base, path) =>
  page.goto(`${base}/admin/shipping/${path}`, { waitUntil: 'networkidle' });

/** Radix Select: відкрити тригер `#id` і обрати опцію за точним текстом. */
export async function pickOption(page, id, text) {
  await page.locator(`#${id}`).click();
  await page.getByRole('option', { name: text, exact: true }).click();
}

/** Рядок таблиці за текстом у ньому. */
export const rowOf = (page, text) =>
  page.getByRole('row', { name: new RegExp(text) });

/** Кошик у рядку → `AlertDialog` → «Видалити». */
export async function deleteRow(page, text) {
  await rowOf(page, text).getByRole('button', { name: 'Видалити' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити' })
    .click();
}

/** Чи є в рядку бейдж «За замовчуванням». */
export async function hasDefaultBadge(page, text) {
  return (await rowOf(page, text).getByText('За замовчуванням').count()) > 0;
}

/** Нова зона лише з назвою → список зон. */
export async function createZone(page, base, name) {
  await go(page, base, 'zones/new');
  await page.locator('#sz-name').fill(name);
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.waitForURL(`${base}/admin/shipping/zones`, { timeout: 15_000 });
  await rowOf(page, name).waitFor({ timeout: 10_000 });
}

/** «Зробити дефолтною» в рядку зони; чекає тост операції. */
export async function makeDefault(page, name) {
  await rowOf(page, name)
    .getByRole('button', { name: 'Зробити дефолтною' })
    .click();
  return waitText(page, 'Дефолтну зону змінено');
}

/**
 * Новий спосіб: провайдер, назва, код, режим ціни → «Створити». Спосіб із
 * `rates` картка відкриває знову (блок «Тарифи»), решту — список.
 */
export async function createMethod(page, base, m) {
  await go(page, base, 'methods/new');
  await pickOption(page, 'sm-provider', m.providerLabel);
  await page.locator('#sm-name').fill(m.name);
  await page.locator('#sm-code').fill(m.code);
  await page.locator('#sm-sort').fill(String(m.sortOrder));
  if (m.pricingLabel) await pickOption(page, 'sm-pricing', m.pricingLabel);
  await page.getByRole('button', { name: 'Створити' }).click();
  return waitText(page, 'Службу створено');
}

/** На картці способу: «Додати тариф» → зона, назва, вартість → «Зберегти». */
export async function addRate(page, rate) {
  await page.getByRole('button', { name: 'Додати тариф' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 10_000 });
  await pickOption(page, 'sr-zone', rate.zone);
  await page.locator('#sr-name').fill(rate.name);
  await page.locator('#sr-baseCost').fill(rate.baseCost);
  await dialog.getByRole('button', { name: 'Зберегти' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
}

/** Нова точка видачі способу `methodName` → список точок. */
export async function createPoint(page, base, p) {
  await go(page, base, 'pickup-points/new');
  await pickOption(page, 'pp-method', p.methodName);
  await page.locator('#pp-name').fill(p.name);
  await page.locator('#pp-city').fill(p.city);
  await page.locator('#pp-address').fill(p.address);
  await page.getByRole('button', { name: 'Створити' }).click();
  await page.waitForURL(`${base}/admin/shipping/pickup-points`, {
    timeout: 15_000,
  });
  await rowOf(page, p.name).waitFor({ timeout: 10_000 });
}

/** Перейменування точки в її картці (після засіву форми з рядка). */
export async function renamePoint(page, base, pointId, from, to) {
  await go(page, base, `pickup-points/${pointId}`);
  await page.waitForFunction(
    ([sel, v]) => document.querySelector(sel)?.value === v,
    ['#pp-name', from],
  );
  await page.locator('#pp-name').fill(to);
  await page.getByRole('button', { name: 'Зберегти' }).click();
  return waitText(page, 'Зміни збережено');
}

/** Спроба видалення зі списку → чи зʼявився тост відмови `toast`. */
export async function tryDelete(page, base, list, rowText, toast) {
  await go(page, base, list);
  await deleteRow(page, rowText);
  return waitText(page, toast);
}

/** Деактивувати (перемикач у рядку) і видалити зі списку `list`. */
export async function deactivateAndDelete(page, base, list, rowText, done) {
  await go(page, base, list);
  await rowOf(page, rowText).getByRole('switch', { name: 'Активна' }).click();
  await waitText(page, 'Статус оновлено');
  await deleteRow(page, rowText);
  await rowOf(page, rowText).waitFor({ state: 'detached', timeout: 10_000 });
  return waitText(page, done);
}

/** Видалити тариф у блоці «Тарифи» картки способу. */
export async function deleteRate(page, base, methodId, rateName) {
  await go(page, base, `methods/${methodId}`);
  await deleteRow(page, rateName);
  return waitText(page, 'Тариф видалено');
}
