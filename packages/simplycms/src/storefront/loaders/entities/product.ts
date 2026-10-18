import type { SanitizedHtml } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { products } from 'simplycms/schema';
import type { Product } from 'simplycms/schema/types';
import { resolveMediaUrls } from 'simplycms/domain/media';
import { productGallerySql } from 'simplycms/translations';

/**
 * Нетекстові колонки товару для сторінки картки: текст (назва, описи, `meta_*`)
 * і адреса приходять з проєкції `catalog_product_texts` у мові запиту (М1, П7/П8).
 * Фото — галерея мови сторінки (`productGallerySql`, Task 17б), тож мапа — функція мови,
 * як `homeProductColumns`: один спосіб зібрати галерею для сторінки й каталогу.
 */
export const productBaseColumns = (locale: string, primary: string) => ({
  id: products.id,
  section_id: products.sectionId,
  is_active: products.isActive,
  is_featured: products.isFeatured,
  created_at: products.createdAt,
  updated_at: products.updatedAt,
  images: productGallerySql(products.id, locale, primary).as('images'),
  has_modifications: products.hasModifications,
  sku: products.sku,
  stock_status: products.stockStatus,
});

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
  /** Фото мовою сторінки (`toGallery`). */
  images: ProductImageViewModel[];
  has_modifications: Product['hasModifications'];
  sku: Product['sku'];
  stock_status: Product['stockStatus'];
};

/**
 * Нормалізує jsonb-масив референсів фото ВІДГУКУ (`product_reviews.images`) у масив
 * ГОТОВИХ URL. Фото товару й модифікації декодує `toGallery` (вони несуть alt мови).
 *
 * 🔴 Резолв саме тут, а не на сторінці. У колонці лежить РЕФЕРЕНС (рішення Е2-1), і саме
 * `resolveMediaUrls` лишає зовнішні URL та `data:`-плейсхолдери як є.
 */
export function toImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return resolveMediaUrls(
    value.filter((item): item is string => typeof item === 'string'),
  );
}
