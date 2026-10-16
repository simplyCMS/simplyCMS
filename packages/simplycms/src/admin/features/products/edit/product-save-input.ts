import type { ProductFormValues, DraftValue } from './product-form-schema';
import { TEXT_FIELDS } from './product-form-schema';

import { baseDiff, orNull, same, textsDiff, type Obj } from './product-diff';

export { same };

export interface SaveInput {
  base?: Obj;
  texts?: Record<string, Obj>;
  modifications?: { upsert?: Obj[]; remove?: string[] };
  propertyValues?: { upsert?: DraftValue[]; remove?: string[] };
  images?: { upsert?: Obj[]; remove?: string[] };
}

/** Позиції upsert-ів у запиті → ідентифікатори, щоб віднести помилку `…upsert.<i>…` до рядка картки. */
export interface SaveIndex {
  modifications: string[];
  propertyValues: string[];
  images: string[];
}

function modificationsDiff(
  a: ProductFormValues,
  b: ProductFormValues,
  index: SaveIndex,
) {
  const ids = new Set(b.modifications.map((m) => m.id));
  const remove = a.modifications.map((m) => m.id).filter((id) => !ids.has(id));
  const upsert: Obj[] = [];
  for (const m of b.modifications) {
    const was = a.modifications.find((x) => x.id === m.id);
    const row: Obj = { id: m.id };
    if (m.sku !== (was?.sku ?? '')) row.sku = orNull(m.sku);
    if (m.isDefault !== (was?.isDefault ?? false)) row.isDefault = m.isDefault;
    if (m.sortOrder !== was?.sortOrder) row.sortOrder = m.sortOrder;
    const names: Record<string, Obj> = {};
    for (const [l, name] of Object.entries(m.texts))
      if (name !== (was?.texts[l] ?? '')) names[l] = { name: orNull(name) };
    if (Object.keys(names).length > 0) row.texts = names;
    const token: Record<string, string> = {};
    for (const [l, slug] of Object.entries(m.token))
      if (slug !== '' && slug !== was?.token[l]) token[l] = slug;
    if (Object.keys(token).length > 0) row.token = token;
    if (was && Object.keys(row).length === 1) continue;
    upsert.push(row);
    index.modifications.push(m.id);
  }
  return { upsert, remove };
}

/**
 * Різниця між завантаженим станом і формою → вхід `products.saveDescription`
 * (без `id` і `expectedVersion`: їх додає `useAggregateCommand`). Порожній
 * результат означає «нічого зберігати».
 */
export function buildSaveInput(
  was: ProductFormValues,
  now: ProductFormValues,
): { input: SaveInput; index: SaveIndex } {
  const index: SaveIndex = {
    modifications: [],
    propertyValues: [],
    images: [],
  };
  const input: SaveInput = {};
  const base = baseDiff(was, now);
  if (Object.keys(base).length > 0) input.base = base;
  const texts = textsDiff(was, now);
  if (Object.keys(texts).length > 0) input.texts = texts;

  const mods = modificationsDiff(was, now, index);
  if (mods.upsert.length > 0 || mods.remove.length > 0)
    input.modifications = {
      ...(mods.upsert.length > 0 && { upsert: mods.upsert }),
      ...(mods.remove.length > 0 && { remove: mods.remove }),
    };
  // Дочірні рядки видаленої модифікації зникають каскадом: у запит не йдуть.
  const gone = new Set(mods.remove);
  const alive = <T extends { modificationId?: string }>(r: T) =>
    !r.modificationId || !gone.has(r.modificationId);

  const diffRows = <T extends { id: string }>(
    prev: readonly T[],
    cur: readonly T[],
    key: keyof SaveIndex,
    idx: (r: T) => string,
  ) => {
    const ids = new Set(cur.map((r) => r.id));
    const remove = prev
      .filter((r) => alive(r as never) && !ids.has(r.id))
      .map((r) => r.id);
    const upsert = cur.filter(
      (r) =>
        alive(r as never) &&
        !same(
          r,
          prev.find((p) => p.id === r.id),
        ),
    );
    for (const r of upsert) index[key].push(idx(r));
    return { upsert, remove };
  };
  const values = diffRows(
    was.propertyValues,
    now.propertyValues,
    'propertyValues',
    (v) => v.propertyId,
  );
  if (values.upsert.length > 0 || values.remove.length > 0)
    input.propertyValues = {
      ...(values.upsert.length > 0 && { upsert: values.upsert }),
      ...(values.remove.length > 0 && { remove: values.remove }),
    };
  const imgs = diffRows(was.images, now.images, 'images', (i) => i.id);
  if (imgs.upsert.length > 0 || imgs.remove.length > 0)
    input.images = {
      ...(imgs.upsert.length > 0 && { upsert: imgs.upsert }),
      ...(imgs.remove.length > 0 && { remove: imgs.remove }),
    };
  return { input, index };
}

export const isEmptyInput = (i: SaveInput) => Object.keys(i).length === 0;

/** Вхід `products.create`: лише непорожні тексти, адреса основної мови — за бажанням. */
export function buildCreateInput(id: string, v: ProductFormValues) {
  const texts: Record<string, Obj> = {};
  for (const [l, row] of Object.entries(v.texts)) {
    const patch: Obj = {};
    for (const f of TEXT_FIELDS) if (row[f] !== '') patch[f] = row[f];
    if (Object.keys(patch).length > 0) texts[l] = patch;
  }
  return {
    id,
    sectionId: orNull(v.sectionId),
    sku: v.hasModifications ? null : orNull(v.sku),
    isActive: v.isActive,
    isFeatured: v.isFeatured,
    hasModifications: v.hasModifications,
    stockStatus: v.hasModifications ? ('in_stock' as const) : v.stockStatus,
    texts,
    ...(v.path !== '' && { path: v.path }),
  };
}
