/**
 * Словники класифікатора `classify.mjs` (задача §2.C.2, план Р3; розширення —
 * інкремент Б.3, блок A.1): URL-патерни і тексти якорів за типом сторінки,
 * англ + укр + рос (транслітерація в шляхах, кирилиця в текстах — кириличні
 * pathname на реальних сайтах рідкісні, Р3).
 * Винесено окремо, щоб `classify.mjs` лишався ≤150 рядків (канон файлу).
 *
 * 🔴 `pathname` сюди приходить уже нормалізованим (`normalizePathname` у
 * `classify.mjs`): без query/hash і без trailing slash — тому «кінець шляху»
 * в патернах позначається просто `$`.
 */

/** URL-патерни за типом (англ + транслітерація укр слів у шляхах). */
export const URL_PATTERNS = {
  listing: [
    /\/(shop|store|catalog|collections?)(\/|$)/i,
    // `catalogue` — британське написання (Shopify/BigCommerce-теми, UK-магазини);
    // наявний `catalog` вимагає далі `/` або кінець, тож `/catalogue` повз нього.
    /\/catalogue(\/|$)/i,
    // `category|categories` — сегмент таксономії каталогу в Magento, PrestaShop,
    // OpenCart і більшості headless-шаблонів.
    /\/categor(y|ies)(\/|$)/i,
    // `product-category` — канонічний префікс таксономії WooCommerce.
    /\/product-category(\/|$)/i,
    // Bare-форми конфліктних сегментів БЕЗ сегмента-дитини — індекс колекції
    // (Next.js-шаблони комерції, WooCommerce-конфігурації з `/product` як
    // коренем каталогу). Дзеркало product-патерну, який дитину ВИМАГАЄ.
    /\/(products?|items?|tovary?)$/i,
    /\/(katalog|magazin)(\/|$)/i,
  ],
  product: [
    /\/(products?|items?)\/[^/]+/i,
    /\/tovary?\/[^/]+/i,
    // `product-page/<slug>` — дефолтний роут картки товару у Wix Stores.
    /\/product-page\/[^/]+/i,
    // `/p/<slug>` — картка у Squarespace Commerce і низці headless-шаблонів.
    /\/p\/[^/]+/i,
    // `<slug>/p` — термінальний маркер картки у VTEX IO.
    /\/p$/i,
    // Сімʼя літерних маркерів `p<id>` окремим токеном сегмента — Rozetka,
    // Ecwid, Prom-legacy (`/p123456-slug`, `/nazva-tovaru-p123`). Межі токена
    // (початок, `/` або `-`) не дають ловити довільні слова з `p` усередині.
    // 🔴 Дзеркальну сімʼю `c<id>` як категорію НЕ вводимо: на Prom.ua це
    // профіль продавця, а не каталог.
    /(^|\/|-)p\d+(-|$)/i,
  ],
  cart: [/\/(cart|basket|bag)(\/|$)/i, /\/korzyna(\/|$)/i],
  checkout: [/\/checkout(\/|$)/i, /\/(oformlennya|zamovlennya|oplata)(\/|$)/i],
  contact: [/\/contacts?(-us)?(\/|$)/i, /\/kontakty(\/|$)/i],
  about: [/\/about/i, /\/pro-nas/i],
};

/** Тексти якорів за типом (англ + укр + рос); зіставляються цілими словами/фразами. */
export const ANCHOR_TERMS = {
  listing: [
    'shop',
    'store',
    'products',
    'catalog',
    'catalogue',
    'collections',
    // Типові написи навігації на індекс каталогу (Shopify/Woo/BigCommerce-теми).
    'categories',
    // Однина — для симетрії з `categories`: безпечна, бо самостійним написом
    // нав-лінка «Category» позначають саме індекс категорій, а не картку.
    'category',
    'browse',
    'all products',
    'shop all',
    // укр
    'каталог',
    'магазин',
    'товари',
    'категорії',
    'асортимент',
    'продукція',
    'крамниця',
    // рос (`каталог`/`магазин` збігаються з укр — вище, не дублюємо)
    'категории',
    'ассортимент',
    'товары',
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
