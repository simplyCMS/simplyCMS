import type { LocaleSet } from 'simplycms/contracts';
import type { HomeProduct } from '../pages/home/types';
import type { ProductDetailProduct } from '../pages/product-detail/types';
import { localeSet } from '../../../test-harness/locale';
import { messages as baseUk } from '../../i18n/catalogs/uk/base';
import { messages as baseEn } from '../../i18n/catalogs/en/base';
import { messages as mailUk } from '../../i18n/catalogs/uk/mail';
import { messages as adminUk } from '../../i18n/catalogs/uk/admin';

// Дані й помічники `no-raw-keys-html.test.tsx` (без React: тест скидає граф модулів на кожен
// кейс, а ці дані від нього не залежать).

// `pl` — опублікована, але пакета інтерфейсу немає: тексти беруться з основної мови.
export const SET: LocaleSet = localeSet('uk', ['uk', 'en', 'pl']);

/** Текст сторінки з каталогу мови інтерфейсу (з самих каталогів, а не з голови). */
export const PAGE_TEXT = {
  uk: {
    '/': baseUk['home.featured'],
    '/x': baseUk['product.addToCart'],
    '/cart': baseUk['cart.title'],
  },
  en: {
    '/': baseEn['home.featured'],
    '/x': baseEn['product.addToCart'],
    '/cart': baseEn['cart.title'],
  },
} as Record<string, Record<string, string>>;

export const RAW_KEYS = new Set([
  ...Object.keys(baseUk),
  ...Object.keys(adminUk),
  ...Object.keys(mailUk),
]);

/** Мінімум товару, який віддає `loadProduct`: текст і SEO уже з проєкції. */
export const product = (locale: string) =>
  ({
    id: 'p1',
    section_id: null,
    slug: 'x',
    name: 'Кабель',
    short_description: null,
    description: null,
    meta_title: null,
    meta_description: null,
    is_active: true,
    is_featured: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    images: [],
    has_modifications: false,
    sku: null,
    stock_status: 'in_stock',
    sections: null,
    product_modifications: [],
    product_prices: [
      {
        price_type_id: 'r',
        modification_id: null,
        price: 100,
        old_price: null,
      },
    ],
    product_property_values: [],
    guest_price_types: { priceTypeId: 'r', defaultPriceTypeId: 'r' },
    page: {
      locale,
      primary: 'uk',
      path: 'x',
      isTranslated: true,
      fallbackFields: [],
      seo: { robots: 'index, follow', canonical: '/x', hreflang: [] },
    },
  }) as unknown as ProductDetailProduct;

export const FEATURED = {
  id: 'p1',
  name: 'Кабель',
  slug: 'x',
  images: [],
  short_description: null,
  stock_status: 'in_stock',
  section: null,
  section_id: null,
  price: 100,
  old_price: null,
  prices: [],
} satisfies HomeProduct;

/** Усі текстові вузли й значення атрибутів документа. */
export function visibleStrings(root: Node): string[] {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE)
      out.push(node.nodeValue?.trim() ?? '');
    if (node instanceof Element)
      for (const attr of Array.from(node.attributes)) out.push(attr.value);
    node.childNodes.forEach(walk);
  };
  walk(root);
  return out.filter(Boolean);
}

export const rawKeysIn = (strings: string[]) =>
  strings.filter((s) => RAW_KEYS.has(s));
