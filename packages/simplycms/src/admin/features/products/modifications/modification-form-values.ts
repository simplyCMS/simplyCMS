import type { ProductModification } from 'simplycms/schema/types';
import type { ModificationFormValues } from './modification-form-schema';

/** Дефолти форми модифікації для СТВОРЕННЯ — виніс із `ModificationDialog.tsx` (канон 150). */
export const EMPTY_MODIFICATION_FORM: ModificationFormValues = {
  name: '',
  slug: '',
  sku: '',
  stockStatus: 'in_stock',
  isDefault: false,
  images: [],
};

/** БД → форма модифікації (`null` полів переведено в порожній рядок). */
export function toModificationFormValues(
  mod: ProductModification,
): ModificationFormValues {
  return {
    name: mod.name,
    slug: mod.slug,
    sku: mod.sku ?? '',
    stockStatus: mod.stockStatus ?? 'in_stock',
    isDefault: mod.isDefault,
    images: mod.images ?? [],
  };
}

/** `null` — СТВОРЕННЯ (дефолти); інакше — переведений рядок БД. */
export function resolveModFormValues(
  mod: ProductModification | null,
): ModificationFormValues {
  return mod ? toModificationFormValues(mod) : EMPTY_MODIFICATION_FORM;
}
