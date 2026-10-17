import type { SanitizedHtml } from 'simplycms/contracts';
import { products } from 'simplycms/schema';
import type { Product } from 'simplycms/schema/types';
import { resolveMediaUrls } from 'simplycms/domain/media';

/**
 * Нетекстові колонки товару для сторінки картки: текст (назва, описи, `meta_*`)
 * і адреса приходять з проєкції `catalog_product_texts` у мові запиту (М1, П7/П8),
 * а не з колонок `products`, які ще дзеркалять лише основну мову.
 */
export const productBaseColumns = {
  id: products.id,
  section_id: products.sectionId,
  is_active: products.isActive,
  is_featured: products.isFeatured,
  created_at: products.createdAt,
  updated_at: products.updatedAt,
  images: products.images,
  has_modifications: products.hasModifications,
  sku: products.sku,
  stock_status: products.stockStatus,
};

/** Повний рядок товару (без приєднаних гілок). */
export type ProductRow = {
  id: Product['id'];
  section_id: Product['sectionId'];
  /** Поточна адреса товару в мові читання (реєстр `url_paths`), а не колонка `products`. */
  slug: string;
  name: string;
  short_description: string | null;
  /**
   * 🔴 Тема 9: розмітка опису — ЗАВЖДИ `SanitizedHtml` (рубіж 2). Сирий SELECT
   * дає `string`, тож рядок мапиться лоадером; каталожний
   * список опису не віддає взагалі (`null`).
   */
  description: SanitizedHtml | null;
  is_active: Product['isActive'];
  is_featured: Product['isFeatured'];
  meta_title: string | null;
  meta_description: string | null;
  created_at: Product['createdAt'];
  updated_at: Product['updatedAt'];
  images: string[];
  has_modifications: Product['hasModifications'];
  sku: Product['sku'];
  stock_status: Product['stockStatus'];
};

/**
 * Нормалізує jsonb-колонку `images` у масив ГОТОВИХ URL.
 *
 * 🔴 Резолв саме тут, а не на сторінці: через цю функцію проходять УСІ
 * читання `images` у вітрині (товар, картка, модифікація, деталь) — один
 * шов замість шести. У колонці лежить РЕФЕРЕНС (рішення Е2-1), і саме
 * `resolveMediaUrls` лишає зовнішні URL та `data:`-плейсхолдери як є.
 */
export function toImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return resolveMediaUrls(
    value.filter((item): item is string => typeof item === 'string'),
  );
}
