/**
 * Контент-верифікація візиту кандидатної сторінки (інкремент Б.3, блок A.4,
 * план Р5). Два експорти різної природи:
 *
 * 1. `browserVisitProbe` виконується В БРАУЗЕРІ через `page.evaluate` —
 *    Playwright серіалізує лише `toString()`, тож функція САМОДОСТАТНЯ: жодних
 *    замикань на модульний скоуп (контракт `browser-reveal.mjs`).
 * 2. `detectVisitMismatch` — чиста функція над пробом, тестується без браузера.
 *
 * 🔴 JSON-LD — ДОДАТКОВИЙ сигнал, а не вимога: величезна частина вітрин
 * розмітки не має взагалі, тож відсутність `jsonLdTypes` НІКОЛИ не є доказом
 * невідповідності — вона лишає рішення за структурою.
 *
 * 🔴 Правила навмисно консервативні: ловимо лише ГРУБУ помилку класифікації
 * (кейс deo — індекс колекції `/product`, що забрав тип `product`), бо ціна
 * хибного спрацювання висока — кандидат відхиляється й тип може лишитись
 * невирішеним. Краще пропустити помилку, ніж вигадати її.
 */
import { FANOUT_MIN_CHILDREN } from './classify-structure.mjs';

/**
 * Скільки карток на сторінці вже роблять її сіткою, а не карткою товару.
 * Шість — бо блок «схожі товари» на картці це звично 3-4 позиції (зрідка 5),
 * а сітка каталогу майже завжди починається від 8-12.
 */
export const GRID_CARDS_MIN = 6;

/**
 * Нижче скількох карток сторінка «списку» вже не схожа на список. 🔴 ВИВОДИТЬСЯ
 * з `FANOUT_MIN_CHILDREN`, а не дублює літералом: там та сама межа з іншого
 * боку («≥3 дітей — уже індекс колекції»), і два `3` розійшлись би при правці.
 */
export const SPARSE_CARDS_MAX = FANOUT_MIN_CHILDREN;

/**
 * Проб сторінки, що виконується в БРАУЗЕРІ. Повертає рівно два сирі виміри —
 * інтерпретація вся в `detectVisitMismatch`.
 * @param {string} [candidateType] тип, під який перевіряється сторінка
 *   (`page.evaluate(probeFn, type)`): від нього залежить, чи виключається
 *   батьківська сімʼя (див. коментар біля відсікань нижче)
 * @returns {{ jsonLdTypes: string[], cardLinks: number }}
 */
export function browserVisitProbe(candidateType) {
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

  // Картка = лінк із зображенням-нащадком із НАЙБІЛЬШОЇ сімʼї однопрефіксних
  // лінків (префікс — усе до останнього `/`); pathname-и в сімʼї дедупляться,
  // тож картка з двома лінками (фото + назва) лишається однією. 🔴 Сімʼя, а
  // не глибина: на `/collections/all` → `/products/<slug>` і
  // `/product-category/<cat>` → `/product/<slug>` індекс і картки лежать на
  // ОДНАКОВІЙ глибині, і умова глибини обнуляла лічильник саме там, де він
  // потрібен. 🔴 Відсікання сімей, щоб оточення сторінки не імітувало сітку
  // (спіймано ревʼю — картка товару відхилялась як «сітка»): `/` (корінь — не
  // кущ: топ-рівневі `/cart`, `/blog`, прапорці мов спільного батька не
  // мають) — НІКОЛИ не рахується; батьківський префікс ПОТОЧНОЇ сторінки
  // (сусіди-товари «схожі»/«нещодавно переглянуті» на картці
  // `/products/<slug>`) — виключається ЛИШЕ для `product`-кандидата.
  // 🔴 Для `listing` батьківську сімʼю рахувати МОЖНА і ТРЕБА (ревʼю Б.3):
  // флет-каталог легітимно ділить префікс зі сторінкою — `/shop/mens` із
  // картками `/shop/product-*` інакше давав би 0 карток і хибний
  // `visit-mismatch`. Напрямок безпечний: більший лічильник для `listing`
  // робить mismatch лише РІДШИМ (правило вимагає cardLinks НИЖЧЕ порогу).
  const strip = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const parent = (p) => p.slice(0, p.lastIndexOf('/') + 1);
  const here = strip(location.pathname);
  const hereParent = parent(here);
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
    const prefix = parent(pathname);
    if (prefix === '/') continue;
    if (candidateType === 'product' && prefix === hereParent) continue;
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
