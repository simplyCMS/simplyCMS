// View-model картки товару (контракт тем v3, спека §4/§5).
// Секційна структура — форвард-сумісність із треком B: gallery / summary /
// description / characteristics.

import type { BreadcrumbItem } from './common';
import type { SlotComponent } from './slots';

/** Галерея: зображення обраної модифікації або самого товару. */
export interface ProductDetailGallery {
  images: string[];
}

/** Шапка картки: назва, артикул, короткий опис, бейдж знижки. */
export interface ProductDetailSummary {
  name: string;
  sku: string | null;
  short_description: string | null;
  /** Відсоток знижки для бейджа «-N%»; null — знижки немає. */
  discountPercent: number | null;
}

/** Повний опис товару (HTML з редактора). */
export interface ProductDetailDescription {
  html: string | null;
}

/**
 * Значення характеристики товару. Форма — 1:1 із пропсами канонічної
 * `ProductCharacteristics`, щоб контейнер не перекладав дані.
 */
export interface ProductPropertyValueViewModel {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
  option: { id: string; slug: string } | null;
  property: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page: boolean;
  } | null;
}

export interface ProductDetailCharacteristics {
  items: ProductPropertyValueViewModel[];
}

export interface ProductDetailSlots {
  /** Точка розширення плагінів перед блоком інформації про товар. */
  PluginBefore: SlotComponent;
  /** Бейджі наявності («під замовлення», «немає в наявності»). */
  StockBadge: SlotComponent;
  /** Точка розширення плагінів у ряду бейджів. */
  PluginBadges: SlotComponent;
  /** Ціна з урахуванням знижок і типу ціни + стара ціна. */
  PriceBlock: SlotComponent;
  /** Вибір модифікації із синхронізацією з URL. */
  ModificationSelector: SlotComponent;
  /** Кнопка додавання в кошик (стани доступності, toast). */
  AddToCart: SlotComponent;
  /** Наявність по точках видачі (власний запит). */
  StockAvailability: SlotComponent;
  /** Відгуки про товар (власний запит). */
  Reviews: SlotComponent;
  /** Точка розширення плагінів після вмісту сторінки. */
  PluginAfter: SlotComponent;
}

export interface ProductDetailViewModel {
  breadcrumbs: BreadcrumbItem[];
  gallery: ProductDetailGallery;
  summary: ProductDetailSummary;
  description: ProductDetailDescription;
  characteristics: ProductDetailCharacteristics;
  slots: ProductDetailSlots;
}
