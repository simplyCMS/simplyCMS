import type { ProductFormValues } from './product-form-schema';
import { TEXT_FIELDS } from './product-form-schema';

/** Дрібні різниці форми (база, тексти) — складові `buildSaveInput`. */
export type Obj = Record<string, unknown>;

/** Структурна рівність JSON-подібних значень (ключі зі значенням `undefined` ігноруються). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const [x, y] = [a as Obj, b as Obj];
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const k of keys) if (!same(x[k], y[k])) return false;
  return true;
}

export const orNull = (s: string) => (s === '' ? null : s);

export function baseDiff(a: ProductFormValues, b: ProductFormValues): Obj {
  const out: Obj = {};
  if (a.sectionId !== b.sectionId) out.sectionId = orNull(b.sectionId);
  if (a.isActive !== b.isActive) out.isActive = b.isActive;
  if (a.isFeatured !== b.isFeatured) out.isFeatured = b.isFeatured;
  if (a.hasModifications !== b.hasModifications)
    out.hasModifications = b.hasModifications;
  // Товар із модифікаціями не має власних sku й статусу — вони на модифікаціях.
  const sku = b.hasModifications ? '' : b.sku;
  if (sku !== a.sku) out.sku = orNull(sku);
  if (b.hasModifications) {
    if (!a.hasModifications) out.stockStatus = 'in_stock';
  } else if (b.stockStatus !== a.stockStatus) out.stockStatus = b.stockStatus;
  return out;
}

/** Лише змінені поля лише змінених мов: незмінена вкладка у запит не потрапляє (І11). */
export function textsDiff(a: ProductFormValues, b: ProductFormValues) {
  const out: Record<string, Obj> = {};
  for (const [locale, cur] of Object.entries(b.texts)) {
    const was = a.texts[locale];
    const patch: Obj = {};
    for (const f of TEXT_FIELDS)
      if (cur[f] !== (was?.[f] ?? '')) patch[f] = orNull(cur[f]);
    if (Object.keys(patch).length > 0) out[locale] = patch;
  }
  return out;
}
