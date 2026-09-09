import { products } from 'simplycms/schema';
import type { Product } from 'simplycms/schema/types';

/**
 * Мапа select-а товару у snake_case (причина ключів — коментар у `./section`).
 *
 * 🔴 `return_policy`/`shipping_details` (B7) свідомо НЕ вибираються: рендерер
 * JSON-LD для них приїде в К2, а зайвий jsonb у кожному рядку списку — це
 * трафік SSR-відповіді без жодного споживача.
 */
export const productColumns = {
  id: products.id,
  section_id: products.sectionId,
  slug: products.slug,
  name: products.name,
  short_description: products.shortDescription,
  description: products.description,
  is_active: products.isActive,
  is_featured: products.isFeatured,
  meta_title: products.metaTitle,
  meta_description: products.metaDescription,
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
  slug: Product['slug'];
  name: Product['name'];
  short_description: Product['shortDescription'];
  description: Product['description'];
  is_active: Product['isActive'];
  is_featured: Product['isFeatured'];
  meta_title: Product['metaTitle'];
  meta_description: Product['metaDescription'];
  created_at: Product['createdAt'];
  updated_at: Product['updatedAt'];
  images: string[];
  has_modifications: Product['hasModifications'];
  sku: Product['sku'];
  stock_status: Product['stockStatus'];
};

/**
 * Нормалізує jsonb-колонку `images` у масив рядків.
 *
 * 🔴 Перевірка рантаймова, а не каст. Колонка — `jsonb` без обмеження форми,
 * тож у ній може лежати що завгодно; галерея товару, що дістала `null` чи
 * обʼєкт замість масиву, падає вже в рендері — далеко від причини.
 */
export function toImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}
