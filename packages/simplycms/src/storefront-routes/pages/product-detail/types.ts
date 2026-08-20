// Спільні типи контейнера картки товару (контракт тем v3, Фаза 3).

import type { DiscountResult } from '@simplycms/core/lib/discountEngine';
import type { Tables } from 'simplycms/supabase';

/**
 * Рядок товару з приєднаними гілками (`sections`, `product_modifications`,
 * `product_prices`, `product_property_values`).
 *
 * Форма — та сама, що вже оголошував проп сторінки: типів джойнів supabase
 * тут не виводить, тож приєднані гілки читаються явними кастами на місці
 * використання (як і до спліту).
 */
export type ProductDetailProduct = Tables<'products'> & Record<string, unknown>;

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

/** Контекст покупця для рушія знижок — те, що віддає `useDiscountContext`. */
export interface DiscountUserContext {
  userId: string | null;
  userCategoryId: string | null;
  isLoggedIn: boolean;
}

/** Ціна однієї модифікації після застосування знижок. */
export interface ModificationPrice {
  price: number;
  oldPrice: number | null;
}

/** Ціна, наявність і артикул для ПОТОЧНОГО вибору (товар або модифікація). */
export interface CurrentPricing {
  stockStatus: string | null;
  price: number | undefined;
  oldPrice: number | null | undefined;
  sku: string | null | undefined;
  /** Ціна до знижки — потрапляє в позицію кошика разом із `discountData`. */
  basePrice: number | undefined;
  discountResult: DiscountResult | null;
  isInStock: boolean;
  discountPercent: number | null;
}
