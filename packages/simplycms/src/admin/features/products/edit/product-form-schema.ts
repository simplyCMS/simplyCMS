import { z } from 'zod';
import type { Product } from 'simplycms/schema/types';

const optionalText = z.string().trim();
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Значення форми картки товару (Task 7). */
export const productFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  shortDescription: optionalText,
  description: optionalText,
  metaTitle: optionalText,
  metaDescription: optionalText,
  sectionId: z.string().min(1),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  hasModifications: z.boolean(),
  sku: optionalText,
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']),
  images: z.array(z.string()),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

const orNull = (s: string) => (s === '' ? null : s);

/**
 * Поля запису з форми. 🔴 Товар із модифікаціями не має власних sku й
 * статусу наявності — вони живуть на модифікаціях (правило легасі
 * `ProductEdit.tsx:169-176`, не змінюється).
 */
export function toProductPatch(v: ProductFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    shortDescription: orNull(v.shortDescription),
    description: orNull(v.description),
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    sectionId: v.sectionId,
    isActive: v.isActive,
    isFeatured: v.isFeatured,
    hasModifications: v.hasModifications,
    images: v.images,
    sku: v.hasModifications ? null : orNull(v.sku),
    stockStatus: v.hasModifications ? ('in_stock' as const) : v.stockStatus,
  } satisfies Partial<Product>;
}

/**
 * Повний оптимістичний рядок для `collection.insert` — колекція тримає
 * `Product`, не `NewProduct`. `returnPolicy`/`shippingDetails` форма не
 * редагує (B7-override — поза етапом), тож тут завжди `null`.
 */
export function toProductDraft(
  v: ProductFormValues,
  id: string,
  now: Date,
): Product {
  return {
    ...toProductPatch(v),
    id,
    createdAt: now,
    updatedAt: now,
    returnPolicy: null,
    shippingDetails: null,
  };
}
