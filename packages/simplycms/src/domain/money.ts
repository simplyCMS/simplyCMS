// Детерміноване форматування ціни — не залежить від версії CLDR рушія.
// ДЕФЕКТ, який лагодить цей модуль: `new Intl.NumberFormat(locale, { style:
// 'currency', currency }).format(n)` бере символ валюти з ICU-даних, вшитих у
// рушій, а вони різняться між Node (SSR) і Chromium (клієнт) — той самий
// виклик на uk-UA/UAH віддає "₴" на сервері й "грн" у браузері. Наслідок —
// гідраційний мисматч на кожній картці товару. Групування розрядів (напр.
// "4 200") в обох рантаймах ІДЕНТИЧНЕ (перевірено побайтово), тому число й
// далі форматуємо через Intl (`style: 'decimal'` — без символу валюти), а сам
// символ беремо з явної мапи нижче, яку рушій змінити не може.
//
// Живе в simplycms/domain (T1, pure-логіка, 0 IO), а не в simplycms/contracts
// (T0, лише типи) — це виконуваний код, і не в react-query (T2) — форматування
// ціни потрібне й поза React (напр. SSR-генератори SEO/метатегів).

import type { ConfigProvider } from 'simplycms/contracts';

/**
 * Символи валют, які фактично використовує вітрина. Явна мапа замість
 * `Intl.NumberFormat({ style: 'currency' })` — саме останній рушій-залежний,
 * звідси й дефект (див. коментар вище). Невідома валюта — фолбек на її ISO-код
 * (напр. "PLN"), а не на порожній рядок: краще видимий код, ніж мовчазна втрата
 * інформації про валюту.
 */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
};

/**
 * Кількість знаків після коми.
 *
 * 🔴 Дефолт саме **0/2**, і це не смак. Тринадцять із чотирнадцяти кол-сайтів,
 * які цей модуль заміщає, передавали рівно `minimumFractionDigits: 0` — і
 * НІЧОГО більше. Для `style: 'currency'` невказаний `maximumFractionDigits`
 * дорівнює розрядності валюти, тобто 2. Тому:
 *   0/2 → "4 200 ₴" і "4 200,5 ₴"   (побайтово те саме, що було);
 *   2/2 → "4 200,00 ₴"               (зайві нулі там, де їх не було);
 *   0/0 → "4 201 ₴"                  (🔴 копійки ОКРУГЛЮЮТЬСЯ ГЕТЬ — це вже
 *                                     неправильна сума, а не косметика).
 * Перевірено прогоном на 4200 / 4200.5 / 4200.55 / 4200.555 / 0 / 99.9.
 * Єдиний кол-сайт, що покладався на валютний дефолт 2/2
 * (`admin/components/ProductModifications.tsx`), передає `2` явно.
 */
export interface FormatPriceOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Форматує ціну як "<число><NBSP><символ>" — саме такий порядок і роздільник
 * (U+00A0, не звичайний пробіл) віддає `Intl.NumberFormat('uk-UA', { style:
 * 'currency', ... })` для гривні, і його явно збережено, бо валютний хвіст
 * тепер формуємо самі, а не Intl. 🔴 Порядок "число-символ" зафіксований під
 * поточну вітрину (лише uk-UA в експлуатації, `simplycms.config.ts`) —
 * per-locale розташування символу (напр. "$100" в en-US) поза межами цього
 * фікса: воно б знову зажадало `style: 'currency'` з тими самими CLDR-ризиками.
 */
export function formatPrice(
  value: number,
  config: Pick<ConfigProvider, 'locale' | 'currency'>,
  options: FormatPriceOptions = {},
): string {
  const { minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;

  const number = new Intl.NumberFormat(config.locale, {
    style: 'decimal',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);

  const code = config.currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? config.currency;

  // Роздільник \u00a0 (NBSP) -- саме такий байт (не звичайний пробіл, U+0020)
  // Intl.NumberFormat('uk-UA', { style: 'currency' }) ставить між числом і
  // символом валюти (перевірено побайтово). Escape-літерал у джерелі, а не
  // сирий символ, -- щоб NBSP не загубився під час майбутнього редагування.
  return `${number}\u00a0${symbol}`;
}
