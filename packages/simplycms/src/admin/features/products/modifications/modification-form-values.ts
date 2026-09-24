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

/**
 * БД → форма модифікації (`null` полів переведено в порожній рядок).
 * 🔴 `stockStatus` СВІДОМО відсутній (рев'ю C6, item 1) — редагування читає
 * й пише статус напряму з живого рядка колекції
 * (`ModificationStatusControl`), а не з форми; клавши сюди
 * `mod.stockStatus`, лишили б мертве поле, яке ніхто не читає.
 */
export function toModificationFormValues(
  mod: ProductModification,
): ModificationFormValues {
  return {
    name: mod.name,
    slug: mod.slug,
    sku: mod.sku ?? '',
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
