// Імена комерційних реквізитів вітрини (контракт тем v3, спека §5).
//
// Реквізит — це прибінджений ядром slot-компонент, який тема лише
// РОЗСТАВЛЯЄ у власному лейауті. Кожен слот рендерить свій маркер
// `data-simplycms-requisite="<імʼя>"` на кореневому елементі — на цьому
// маркері тримається conformance-гейт (рендер заявленого темою view на
// фікстурах + пошук обовʼязкових реквізитів у DOM).
//
// 🔴 Чому імена живуть у T0, а не поруч зі слотами
// (`@simplycms/storefront-routes`) чи поруч із kit-ом (`@simplycms/themes`):
// їх потребують ОБИДВА боки — слот, що малює маркер, і kit, що його шукає, —
// а theme-system не має права залежати від route-пакета (тіри T0→T5).
//
// Склад знято з ФАКТИЧНОГО JSX канонічних сторінок (YAGNI, Р2): жодного
// реквізиту «на майбутнє». Пагінації тут немає, бо її немає й у каталозі.

import type { CartSlots } from './cart';
import type { CatalogSlots } from './catalog';
import type { HomeSlots } from './home';
import type { ProductDetailSlots } from './product-detail';

/** Атрибут-маркер, який рендерить кожен slot-компонент ядра. */
export const REQUISITE_ATTRIBUTE = 'data-simplycms-requisite';

/**
 * 🔴 `satisfies Record<keyof …Slots, string>` — не косметика: саме воно
 * тримає рантайм-список і контрактний тип слотів в одному стані. Новий слот
 * у view-model без імені тут (або зайве імʼя) — червоний `pnpm typecheck`.
 */
export const HOME_REQUISITES = {
  SectionCarousel: 'home.section-carousel',
} as const satisfies Record<keyof HomeSlots, string>;

export const CATALOG_REQUISITES = {
  SectionChips: 'catalog.section-chips',
  Filters: 'catalog.filters',
  SortSelect: 'catalog.sort-select',
  ViewModeToggle: 'catalog.view-mode-toggle',
  ActiveFilters: 'catalog.active-filters',
  ProductGrid: 'catalog.product-grid',
} as const satisfies Record<keyof CatalogSlots, string>;

export const PRODUCT_DETAIL_REQUISITES = {
  PluginBefore: 'product-detail.plugin-before',
  StockBadge: 'product-detail.stock-badge',
  PluginBadges: 'product-detail.plugin-badges',
  PriceBlock: 'product-detail.price-block',
  ModificationSelector: 'product-detail.modification-selector',
  AddToCart: 'product-detail.add-to-cart',
  StockAvailability: 'product-detail.stock-availability',
  Reviews: 'product-detail.reviews',
  PluginAfter: 'product-detail.plugin-after',
} as const satisfies Record<keyof ProductDetailSlots, string>;

export const CART_REQUISITES = {
  Items: 'cart.items',
  ClearCart: 'cart.clear-cart',
  Summary: 'cart.summary',
  Checkout: 'cart.checkout',
} as const satisfies Record<keyof CartSlots, string>;

/** Імʼя будь-якого реквізиту вітрини. */
export type RequisiteName =
  | (typeof HOME_REQUISITES)[keyof typeof HOME_REQUISITES]
  | (typeof CATALOG_REQUISITES)[keyof typeof CATALOG_REQUISITES]
  | (typeof PRODUCT_DETAIL_REQUISITES)[keyof typeof PRODUCT_DETAIL_REQUISITES]
  | (typeof CART_REQUISITES)[keyof typeof CART_REQUISITES];

/** Канонічна сторінка вітрини, view якої тема може перевизначити. */
export type StorefrontViewName =
  'Home' | 'Catalog' | 'CatalogSection' | 'ProductDetail' | 'Cart';

/**
 * Мінімальний склад: сторінка → реквізити, які ОБОВʼЯЗКОВО має розставити
 * будь-який view (канонічний ядра або власний теми).
 *
 * Список навмисно збігається з повним набором слотів сторінки — АЛЕ лише
 * там, де слот рендериться безумовно, незалежно від даних. Де сторінка
 * структурно прибирає весь блок реквізитів разом із даними (Home без
 * кореневих секцій, порожній Cart), слот вважати «обовʼязковим» не можна:
 * маркер там не зʼявиться в принципі, і гейт червонів би не на дефекті.
 *
 * - **Home:** спека §5 прямо каже — «без обовʼязкових комерційних
 *   реквізитів (Header/Footer дає каркас)». `SectionCarousel` рендериться
 *   0..N разів (по кореневій секції); магазин без категорій — валідний стан.
 * - **Cart:** спека §5 називає лише «список позицій, сума, перехід до
 *   checkout» — `ClearCart` навмисно ВИКЛЮЧЕНО: це зручність, а не функція
 *   ядра (без неї купівля не ламається), і в порожньому кошику показувати
 *   нічого.
 *
 * Решта сторінок (Catalog/CatalogSection/ProductDetail) рендерять усі свої
 * слоти БЕЗУМОВНО (крайній стан міняє вміст слота, не забирає сам слот) —
 * там список і лишається повним набором.
 *
 * Гейт жорсткий і без рантайм-fallback-у (V3): пропущений реквізит видно на
 * тестах, а не в проді порожнім місцем.
 */
export const REQUIRED_REQUISITES = {
  Home: [],
  Catalog: Object.values(CATALOG_REQUISITES),
  CatalogSection: Object.values(CATALOG_REQUISITES),
  ProductDetail: Object.values(PRODUCT_DETAIL_REQUISITES),
  Cart: [
    CART_REQUISITES.Items,
    CART_REQUISITES.Summary,
    CART_REQUISITES.Checkout,
  ],
} as const satisfies Record<StorefrontViewName, readonly RequisiteName[]>;
