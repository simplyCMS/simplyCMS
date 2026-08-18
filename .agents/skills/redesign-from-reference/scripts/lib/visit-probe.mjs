/**
 * Контент-верифікація візиту кандидатної сторінки (інкремент Б.3, блок A.4,
 * план Р5). Два експорти різної природи:
 *
 * 1. `browserVisitProbe` виконується В БРАУЗЕРІ через `page.evaluate` —
 *    Playwright серіалізує лише `toString()`, тож функція САМОДОСТАТНЯ:
 *    жодних замикань на модульний скоуп (той самий контракт, що
 *    `browser-reveal.mjs`/`browser-sample.mjs`).
 * 2. `detectVisitMismatch` — чиста функція над зібраним пробом, тестується
 *    без браузера.
 *
 * 🔴 JSON-LD тут — ДОДАТКОВИЙ сигнал, а не вимога: величезна частина вітрин
 * розмітки не має взагалі, і такі сторінки деградують до самого лічильника
 * карток. Тому правила сформульовані так, що відсутність `jsonLdTypes` НІКОЛИ
 * не є доказом невідповідності — вона просто лишає рішення за структурою.
 *
 * 🔴 Правила навмисно консервативні: ловимо лише ГРУБУ помилку класифікації
 * (кейс deo — індекс колекції `/product`, що забрав тип `product`), бо ціна
 * хибного спрацювання висока: кандидат відхиляється й тип може лишитись
 * невирішеним. Краще пропустити помилку, ніж вигадати її.
 */

/**
 * Скільки карток на сторінці вже роблять її сіткою, а не карткою товару.
 * Шість — бо типова картка товару теж має блок «схожі товари» (звична
 * розкладка — 3-4 позиції, зрідка 5), і поріг має лишатись вищим за нього;
 * сітка каталогу натомість майже завжди починається від 8-12 позицій.
 */
export const GRID_CARDS_MIN = 6;

/**
 * Нижче скількох карток сторінка «списку» вже не схожа на список. Три — бо
 * рівно стільки ж дітей вимагає структурний fan-out (`classify-structure.mjs`)
 * і тримати два різні уявлення про «мінімальний список» у одному інструменті
 * не можна.
 */
export const SPARSE_CARDS_MAX = 3;

/**
 * Проб сторінки, що виконується в БРАУЗЕРІ. Повертає рівно два сирі виміри —
 * інтерпретація вся в `detectVisitMismatch`.
 * @returns {{ jsonLdTypes: string[], cardLinks: number }}
 */
export function browserVisitProbe() {
  // Обхід JSON-LD довільної вкладеності: масив на верхньому рівні, `@graph`,
  // `itemListElement` → `item` → `@type`. Рекурсія по всіх значеннях, а не по
  // списку відомих ключів: схеми різняться між платформами, а глибина
  // JSON-LD-документа мала й циклів у `JSON.parse` не буває.
  const types = [];
  const collect = (node) => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const raw = node['@type'];
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (typeof value === 'string' && value) types.push(value);
    }
    for (const key of Object.keys(node)) {
      if (key !== '@type') collect(node[key]);
    }
  };
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      collect(JSON.parse(script.textContent || ''));
    } catch {
      // Битий JSON-LD — не помилка проба: сторінки з поламаною розміткою
      // трапляються постійно, і це не привід валити візит.
    }
  }

  // Картка = лінк із зображенням-нащадком, що веде ГЛИБШЕ за поточну сторінку.
  // 🔴 Саме глибше за КІЛЬКІСТЮ СЕГМЕНТІВ, а не «нащадок поточного шляху»:
  // вітрина `/shop` часто веде на картки `/products/<slug>` (інший префікс), і
  // вимога нащадка обнулила б лічильник на цілком нормальному списку. Умова
  // глибини відсікає навігацію (шапка/футер ведуть на той самий або мілкіший
  // рівень) — саме вона й відрізняє повторювані картки-діти від меню.
  const depth = (pathname) => pathname.split('/').filter(Boolean).length;
  const here = depth(location.pathname);
  let cardLinks = 0;
  for (const anchor of document.querySelectorAll('a[href]')) {
    if (!anchor.querySelector('img')) continue;
    let parsed;
    try {
      parsed = new URL(anchor.href);
    } catch {
      continue; // `javascript:`/биті href — не URL
    }
    // Чужий origin — партнерські банери й віджети, не картки цього каталогу.
    if (parsed.origin !== location.origin) continue;
    if (depth(parsed.pathname) > here) cardLinks += 1;
  }

  return { jsonLdTypes: types, cardLinks };
}

/** `https://schema.org/Product` і `Product` — той самий тип; порівнюємо хвіст. */
function isProductType(value) {
  return (
    typeof value === 'string' &&
    value.split('/').pop().toLowerCase() === 'product'
  );
}

/**
 * Чи суперечить зміст сторінки типу, який їй призначив класифікатор.
 * @param {string} type канонічний тип сторінки
 * @param {{ jsonLdTypes?: unknown, cardLinks?: unknown } | null | undefined} probe
 *   результат `browserVisitProbe`; відсутній/порожній проб — НЕ доказ
 *   невідповідності (пробу просто не проводили), тому `false`
 * @returns {boolean}
 */
export function detectVisitMismatch(type, probe) {
  if (!probe || typeof probe !== 'object') return false;
  const jsonLdTypes = Array.isArray(probe.jsonLdTypes) ? probe.jsonLdTypes : [];
  const cardLinks = Number.isFinite(probe.cardLinks) ? probe.cardLinks : 0;
  const hasProduct = jsonLdTypes.some(isProductType);

  // Тип `product`, а перед нами сітка карток без жодної Product-розмітки —
  // рівно кейс deo: індекс колекції, що виграв тип у справжньої картки.
  if (type === 'product') return cardLinks >= GRID_CARDS_MIN && !hasProduct;
  // Тип `listing`, а сторінка розмічена як товар і карток на ній майже немає.
  // 🔴 Обидві умови обовʼязкові: сама лише Product-розмітка списком не керує —
  // вітрини штатно вкладають `Product` в `ItemList`.
  if (type === 'listing') return hasProduct && cardLinks < SPARSE_CARDS_MAX;
  return false;
}
