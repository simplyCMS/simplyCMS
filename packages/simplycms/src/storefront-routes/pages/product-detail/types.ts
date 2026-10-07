// Спільні типи контейнера картки товару (контракт тем v3, Фаза 3).

import type { StockStatus, ThresholdHint } from 'simplycms/contracts';
import type { ProductDetailRow } from 'simplycms/storefront/loaders';

/**
 * Рядок товару з приєднаними гілками (`sections`, `product_modifications`,
 * `product_prices`, `product_property_values`).
 *
 * 🔴 Тип тепер приходить із серверного лоадера, а не з генерату PostgREST:
 * SSR і клієнт беруть товар ОДНИМ і тим самим `getProduct`, тож розходитись
 * їхнім формам більше ні на чому.
 */
export type ProductDetailProduct = ProductDetailRow;

/** Модифікація товару у вигляді, потрібному картці. */
export interface ProductModificationRow {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  sort_order: number;
  stock_status: 'in_stock' | 'out_of_stock' | 'on_order' | null;
  sku: string | null;
  images: unknown;
}

/** Розділ товару — потрібен крихтам і контексту знижок. */
export interface ProductSectionRef {
  id: string;
  slug: string;
  name: string;
}

/** Ціна однієї модифікації після застосування знижок. */
export interface ModificationPrice {
  price: number;
  oldPrice: number | null;
}

/** Ціна, наявність і артикул для ПОТОЧНОГО вибору (товар або модифікація). */
export interface CurrentPricing {
  stockStatus: StockStatus | null;
  price: number | undefined;
  oldPrice: number | null | undefined;
  sku: string | null | undefined;
  /** Порогові підказки знижок (Е6в-12) для блоку ціни. */
  hints: ThresholdHint[];
  isInStock: boolean;
  discountPercent: number | null;
}
