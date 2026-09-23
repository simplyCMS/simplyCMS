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
  // 🔴 Легасі (ProductEdit.tsx) дозволяв товар без розділу — `section_id:
  // formData.section_id || null` без клієнтської валідації; FK у схемі
  // nullable ON DELETE SET NULL. Панелі властивостей і так умовні на
  // sectionId (`data.sectionId &&`), тож min(1) тут був би СТРОГІШИМ за
  // легасі й за схему БД без причини.
  sectionId: optionalText,
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
 *
 * 🔴 МAJOR (рев'ю хвилі C): `stockStatus` НЕ входить у patch для простого
 * товару — контролюється миттєвим `StockStatusSelect` над ЖИВИМ рядком
 * колекції (`products.update` напряму, `SimpleProductPanel`) і гвардом
 * `saveStock` (Е3-3). Якби patch ніс `v.stockStatus`, кожен Save картки
 * перезаписував би щойно виставлений статус стейл-значенням форми
 * (`useForm({defaultValues})` не стежить за зовнішнім write-back). Виняток
 * — перемикання товару НА «з модифікаціями»: мод-товар власного контролу
 * не має, статус фіксується `in_stock` тут же (як і раніше).
 */
export function toProductPatch(v: ProductFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    shortDescription: orNull(v.shortDescription),
    description: orNull(v.description),
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    sectionId: orNull(v.sectionId),
    isActive: v.isActive,
    isFeatured: v.isFeatured,
    hasModifications: v.hasModifications,
    images: v.images,
    sku: v.hasModifications ? null : orNull(v.sku),
    ...(v.hasModifications && { stockStatus: 'in_stock' as const }),
  } satisfies Partial<Product>;
}

/**
 * Повний оптимістичний рядок для `collection.insert` — колекція тримає
 * `Product`, не `NewProduct`. `returnPolicy`/`shippingDetails` форма не
 * редагує (B7-override — поза етапом), тож тут завжди `null`.
 *
 * 🔴 `stockStatus` тут ЗАВЖДИ виставляється явно (`toProductPatch` несе
 * його лише умовно): товару щойно немає в БД — миттєвого контролу над
 * живим рядком ще нема, початкове значення бере форма.
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
    stockStatus: v.hasModifications ? 'in_stock' : v.stockStatus,
  };
}
