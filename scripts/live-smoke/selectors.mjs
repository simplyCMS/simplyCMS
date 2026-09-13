/**
 * Селектори й розбір чисел для браузерної воронки живого прогону.
 *
 * 🔴 Живуть окремо від `funnel.mjs` не заради лічильника, а тому що це
 * КОНТРАКТ РОЗМІТКИ, а не крок воронки: `id` контролів чекауту ставить
 * Task 11 (`checkout-ui`, `id`/`htmlFor` доступних імен), і коли розмітка
 * зміниться, правити треба саме тут — в одному місці, а не шукати рядки
 * посеред сценарію. `#checkout-total` окремо: на ньому тримається доказ
 * М-12 «підсумок = замовлення».
 */

/** id контролів чекауту — `id`/`htmlFor` з Task 11 (checkout-ui). */
export const FIELD = {
  firstName: '#checkout-first-name',
  phone: '#checkout-phone',
  pickupPoint: '#checkout-pickup-point',
  total: '#checkout-total',
};

/** Слаг товару, на якому ганяється воронка (демо-сід). */
export const PRODUCT_SLUG = 'sonyachna-panel-450w-mono';

/** "7 200,50 ₴" → 7200.5 — усе, крім цифр і десяткового роздільника, геть. */
export function parseMoney(text) {
  return Number((text ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
}
