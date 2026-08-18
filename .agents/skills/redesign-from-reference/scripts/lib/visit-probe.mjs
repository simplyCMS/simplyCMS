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
 * рівно стільки ж дітей вимагає структурний fan-out (`classify-structure.mjs`),
 * а двох уявлень про «мінімальний список» в одному інструменті бути не може.
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

  // Картка = лінк із зображенням-нащадком, що входить у НАЙБІЛЬШУ сімʼю
  // однопрефіксних лінків (усе до останнього `/` — спільний батьківський
  // префікс). 🔴 Не «глибше за поточну сторінку»: на двох найпоширеніших
  // розкладках індекс і картки лежать на ОДНАКОВІЙ глибині
  // (`/collections/all` → `/products/<slug>`, `/product-category/<cat>` →
  // `/product/<slug>`), тож умова глибини обнуляла лічильник рівно там, де він
  // потрібен. Сімʼя ловить не глибину, а ПОВТОРЮВАНІСТЬ: картки каталогу
  // завжди діляться одним префіксом, а різнорідне іконкове меню (`/cart`,
  // `/about`, `/blog`) у велику групу не збирається. Pathname-и всередині
  // сімʼї дедупляться — картка з двома лінками лишається однією карткою.
  const strip = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const here = strip(location.pathname);
  const families = new Map();
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
    const pathname = strip(parsed.pathname);
    if (pathname === here) continue; // лінк на саму себе — логотип чи крихти
    const prefix = pathname.slice(0, pathname.lastIndexOf('/') + 1);
    const family = families.get(prefix);
    if (family) family.add(pathname);
    else families.set(prefix, new Set([pathname]));
  }
  let cardLinks = 0;
  for (const family of families.values())
    cardLinks = Math.max(cardLinks, family.size);

  return { jsonLdTypes: types, cardLinks };
}

/** `https://schema.org/Product` і `Product` — той самий тип; порівнюємо хвіст. */
function tailIn(value, names) {
  return (
    typeof value === 'string' && names.has(value.split('/').pop().toLowerCase())
  );
}

const PRODUCT_TYPES = new Set(['product']);
/** Розмітка, якою вітрина ЗАЯВЛЯЄ себе списком, — пряме спростування типу `product`-сторінки. */
const COLLECTION_TYPES = new Set(['collectionpage', 'itemlist']);

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
  const hasProduct = jsonLdTypes.some((t) => tailIn(t, PRODUCT_TYPES));
  const hasCollection = jsonLdTypes.some((t) => tailIn(t, COLLECTION_TYPES));

  // Тип `product`, а перед нами сітка карток без жодної Product-розмітки —
  // рівно кейс deo: індекс колекції, що виграв тип у справжньої картки.
  if (type === 'product') return cardLinks >= GRID_CARDS_MIN && !hasProduct;
  // Тип `listing`, а сторінка розмічена як товар і карток на ній майже немає.
  // 🔴 Правило має ловити лише сторінку, яка Є ВИКЛЮЧНО товаром, а не список,
  // що товари згадує, — тому три умови, і колекційна розмітка серед них
  // головна: вітрини штатно вкладають `Product` в `ItemList`, тож на
  // коректному індексі каталогу `hasProduct` істинний за проєктом.
  if (type === 'listing')
    return !hasCollection && hasProduct && cardLinks < SPARSE_CARDS_MAX;
  return false;
}
