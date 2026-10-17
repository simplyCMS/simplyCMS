import type {
  DraftImage,
  DraftModification,
} from '../edit/product-form-schema';
import { imageKeys } from '../edit/product-images';
import type { ModificationFormValues } from './modification-form-schema';

/** Дефолти форми для СТВОРЕННЯ. */
export const emptyModificationForm = (
  locales: readonly string[],
): ModificationFormValues => ({
  names: Object.fromEntries(locales.map((l) => [l, ''])),
  tokens: Object.fromEntries(locales.map((l) => [l, ''])),
  sku: '',
  isDefault: false,
  stockStatus: 'in_stock',
  images: [],
});

/** Чернетка модифікації (+ її фото) → значення форми діалогу. */
export function toModificationFormValues(
  mod: DraftModification,
  images: readonly DraftImage[],
  locales: readonly string[],
): ModificationFormValues {
  return {
    names: Object.fromEntries(locales.map((l) => [l, mod.texts[l] ?? ''])),
    tokens: Object.fromEntries(locales.map((l) => [l, mod.token[l] ?? ''])),
    sku: mod.sku,
    isDefault: mod.isDefault,
    stockStatus: mod.stockStatus,
    images: imageKeys(images, mod.id),
  };
}

export function resolveModFormValues(
  mod: DraftModification | null,
  images: readonly DraftImage[],
  locales: readonly string[],
): ModificationFormValues {
  return mod
    ? toModificationFormValues(mod, images, locales)
    : emptyModificationForm(locales);
}

/** Значення форми діалогу → чернетка модифікації (порядок задає викликач). */
export function toDraftModification(
  id: string,
  form: ModificationFormValues,
  sortOrder: number,
): DraftModification {
  return {
    id,
    sku: form.sku,
    isDefault: form.isDefault,
    stockStatus: form.stockStatus,
    sortOrder,
    texts: { ...form.names },
    token: { ...form.tokens },
  };
}
