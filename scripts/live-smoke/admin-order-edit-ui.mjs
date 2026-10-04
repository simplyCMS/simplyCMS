/**
 * Дії браузера кроку редагування позицій К3-Е5б (`./admin-order-edit.mjs`)
 * — окремим модулем за каноном 150 рядків. Це КОНТРАКТ РОЗМІТКИ картки
 * замовлення (`admin/features/orders/detail/**`): доступні імена — з
 * uk-каталогу, тож зміна тексту чи `aria-label` правиться тут, а не посеред
 * сценарію. Перевірок тут немає — лише дії; SQL-доказ робить крок.
 */
import {
  addToCart,
  openCheckoutPrefilled,
  submitCheckout,
} from './place-order.mjs';
import { PRODUCT_SLUG, parseMoney } from './selectors.mjs';

/**
 * Покупець оформлює замовлення товару воронки (`PRODUCT_SLUG`) — хелпери Е5
 * у тій самій послідовності, що `admin-orders-buyer.mjs`.
 */
export async function placeOrder({ page, base, dbUrl, section }) {
  await addToCart({ page, base, section, productSlug: PRODUCT_SLUG });
  await openCheckoutPrefilled({ page, base });
  return submitCheckout({ page, base, dbUrl });
}

/** Картка замовлення в адмінці. */
export function openCard({ page, base, orderId }) {
  return page.goto(`${base}/admin/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
}

/**
 * `OrderItemQuantity`: поле `aria-label="Кількість: <назва>"`, збереження —
 * Enter (або blur).
 */
export async function setQuantity({ page, name, quantity }) {
  const input = page.getByRole('spinbutton', { name: `Кількість: ${name}` });
  await input.fill(String(quantity));
  await input.press('Enter');
}

/**
 * `AddOrderItemDialog` → `ProductSearchList`: «Додати товар» → запит у
 * пошук (debounce 300 мс) → клік по результату з назвою `hit` → кількість
 * за замовчуванням 1 → «Додати до замовлення».
 */
export async function addBySearch({ page, query, hit }) {
  await page.getByRole('button', { name: 'Додати товар', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Пошук за назвою або артикулом...').fill(query);
  await dialog.getByRole('button', { name: hit }).first().click();
  await dialog.getByRole('button', { name: 'Додати до замовлення' }).click();
}

/**
 * `RemoveOrderItemDialog`: кнопка `aria-label="Видалити: <назва>"` →
 * `alertdialog` → «Видалити».
 */
export async function removeItem({ page, name }) {
  await page.getByRole('button', { name: `Видалити: ${name}` }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Видалити', exact: true })
    .click();
}

/** Кабінет покупця: сума «Разом» картки замовлення (те, що бачить покупець). */
export async function cabinetTotal({ page, base, orderId }) {
  await page.goto(`${base}/profile/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
  const cell = page
    .getByText('Разом', { exact: true })
    .last()
    .locator('xpath=following-sibling::span[1]');
  await cell.waitFor({ timeout: 10_000 });
  return parseMoney(await cell.textContent());
}

/** Покупець скасовує в кабінеті — той самий шлях, що у воронці. */
export async function buyerCancel({ page, base, orderId }) {
  await page.goto(`${base}/profile/orders/${orderId}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await page.getByRole('button', { name: /Так, скасувати/ }).click();
  await page.waitForURL(/\/profile\/orders$/, { timeout: 15_000 });
}

/**
 * Лічильник `pageerror` сторінки: `report` — рядок `check` «нуль помилок»,
 * `stop` знімає слухача (сторінка покупця спільна з іншими кроками).
 */
export function trackErrors(page) {
  const list = [];
  const on = (e) => list.push(String(e));
  page.on('pageerror', on);
  return {
    list,
    report: (check, label) =>
      check(label, list.length === 0, list.length ? list.join(' | ') : '0'),
    stop: () => page.off('pageerror', on),
  };
}
