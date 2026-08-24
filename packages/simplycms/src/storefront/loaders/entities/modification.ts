import { productModifications } from 'simplycms/schema';
import type { ProductModification } from 'simplycms/schema/types';
import { toImageList } from './product';

/** Модифікація для картки товару (форма, яку читає `useModificationData`). */
export const modificationColumns = {
  id: productModifications.id,
  product_id: productModifications.productId,
  slug: productModifications.slug,
  name: productModifications.name,
  sku: productModifications.sku,
  is_default: productModifications.isDefault,
  sort_order: productModifications.sortOrder,
  stock_status: productModifications.stockStatus,
  images: productModifications.images,
};

export type ModificationRow = {
  id: ProductModification['id'];
  product_id: ProductModification['productId'];
  slug: ProductModification['slug'];
  name: ProductModification['name'];
  sku: ProductModification['sku'];
  is_default: ProductModification['isDefault'];
  sort_order: ProductModification['sortOrder'];
  stock_status: ProductModification['stockStatus'];
  images: string[];
};

/** Нормалізує `images` модифікації тим самим правилом, що й у товару. */
export function toModificationRow(row: {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  sku: string | null;
  is_default: boolean;
  sort_order: number;
  stock_status: ProductModification['stockStatus'];
  images: unknown;
}): ModificationRow {
  return { ...row, images: toImageList(row.images) };
}

/**
 * Скорочена модифікація для списків каталогу: більше нічого й не треба —
 * список показує ціну ОДНІЄЇ модифікації за замовчуванням, а вибрати її
 * можна рівно за цими двома полями.
 */
export const listModificationColumns = {
  id: productModifications.id,
  product_id: productModifications.productId,
  is_default: productModifications.isDefault,
  sort_order: productModifications.sortOrder,
};
