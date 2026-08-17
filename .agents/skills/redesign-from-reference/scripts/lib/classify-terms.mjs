/**
 * Словники класифікатора `classify.mjs` (задача §2.C.2, план Р3): URL-патерни
 * і тексти якорів за типом сторінки, англ + укр (транслітерація в шляхах,
 * кирилиця в текстах — кириличні pathname на реальних сайтах рідкісні, Р3).
 * Винесено окремо, щоб `classify.mjs` лишався ≤150 рядків (канон файлу).
 */

/** URL-патерни за типом (англ + транслітерація укр слів у шляхах). */
export const URL_PATTERNS = {
  listing: [
    /\/(shop|store|catalog|collections?)(\/|$)/i,
    /\/(katalog|magazin)(\/|$)/i,
  ],
  product: [/\/(products?|items?)\/[^/]+/i, /\/tovary?\/[^/]+/i],
  cart: [/\/(cart|basket|bag)(\/|$)/i, /\/korzyna(\/|$)/i],
  checkout: [/\/checkout(\/|$)/i, /\/(oformlennya|zamovlennya|oplata)(\/|$)/i],
  contact: [/\/contacts?(-us)?(\/|$)/i, /\/kontakty(\/|$)/i],
  about: [/\/about/i, /\/pro-nas/i],
};

/** Тексти якорів за типом (англ + укр); зіставляються цілими словами/фразами. */
export const ANCHOR_TERMS = {
  listing: [
    'shop',
    'store',
    'products',
    'catalog',
    'catalogue',
    'collections',
    'каталог',
    'магазин',
    'товари',
  ],
  product: ['product', 'товар'],
  cart: ['cart', 'basket', 'bag', 'кошик', 'корзина'],
  checkout: [
    'checkout',
    'place order',
    'оформити замовлення',
    'оформлення',
    'оплата',
  ],
  contact: ['contact', 'contact us', 'контакти'],
  about: ['about', 'about us', 'про нас', 'про компанію'],
};

/** Перший URL-патерн типу, що збігся з `pathname` — джерело `evidence.urlPattern`. */
export function matchUrlPattern(type, pathname) {
  for (const pattern of URL_PATTERNS[type]) {
    if (pattern.test(pathname)) return pattern.source;
  }
  return null;
}

/** Текст → пробільно-обгорнутий рядок без пунктуації — для пошуку цілих слів/фраз. */
function normalizeText(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return ` ${words} `;
}

/** Перший якірний текст типу, де знайдено цілий термін зі словника — `evidence.anchorMatch`. */
export function matchAnchorTerm(type, anchors) {
  for (const anchor of anchors) {
    const normalized = normalizeText(anchor);
    for (const term of ANCHOR_TERMS[type]) {
      if (normalized.includes(` ${term} `)) return anchor;
    }
  }
  return null;
}
