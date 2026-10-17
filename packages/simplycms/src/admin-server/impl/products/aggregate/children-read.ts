import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { TRANSLATABLE, loadTranslations } from 'simplycms/translations';
import type { StoredTranslation } from 'simplycms/translations';
import type { ChildrenOut } from './children-read-schema';
import { withStatuses } from './children-status';
import { loadPropertyValues } from './property-value-read';

export { childrenOut, type ChildrenOut } from './children-read-schema';

async function loadModifications(
  db: ActorDb,
  productId: string,
  primary: string,
): Promise<ChildrenOut['modifications']> {
  const mods = (
    await db.execute<{
      id: string;
      sku: string | null;
      is_default: boolean;
      sort_order: number;
      stock_status: 'in_stock' | 'out_of_stock' | 'on_order';
    }>(
      sql`select id, sku, is_default, sort_order, stock_status from public.product_modifications
           where product_id = ${productId} order by sort_order, id`,
    )
  ).rows;
  const texts = await loadTranslations(
    db,
    TRANSLATABLE.productModification,
    mods.map((m) => m.id),
  );
  const tokens = (
    await db.execute<{ modification_id: string; locale: string; slug: string }>(
      sql`select modification_id, locale, slug from public.slug_tokens
           where scope_id = ${productId} and token_kind = 'modification' and is_current`,
    )
  ).rows;
  return mods.map((m) => ({
    id: m.id,
    sku: m.sku,
    isDefault: m.is_default,
    sortOrder: m.sort_order,
    stockStatus: m.stock_status,
    texts: Object.fromEntries(
      Object.entries(
        withStatuses(
          TRANSLATABLE.productModification,
          texts.get(m.id),
          primary,
        ),
      ).map(([l, r]) => [
        l,
        {
          name: r.values.name ?? null,
          status: r.status,
          fieldStatus: r.fields,
        },
      ]),
    ),
    token: Object.fromEntries(
      tokens
        .filter((t) => t.modification_id === m.id)
        .map((t) => [t.locale, t.slug]),
    ),
  }));
}

async function loadImages(
  db: ActorDb,
  productId: string,
  primary: string,
): Promise<ChildrenOut['images']> {
  const imgs = (
    await db.execute<{
      id: string;
      storage_key: string;
      sort_order: number;
      modification_id: string | null;
    }>(
      sql`select id, storage_key, sort_order, modification_id from public.product_images
           where product_id = ${productId} order by sort_order, created_at, id`,
    )
  ).rows;
  const texts = await loadTranslations(
    db,
    TRANSLATABLE.productImage,
    imgs.map((i) => i.id),
  );
  return imgs.map((i) => {
    const alt: Record<string, string | null> = {};
    const overrides: Record<string, string> = {};
    for (const [l, r] of texts.get(i.id) ??
      new Map<string, StoredTranslation>()) {
      if (r.values.alt != null) alt[l] = r.values.alt;
      if (l !== primary && r.values.storage_key)
        overrides[l] = r.values.storage_key;
    }
    return {
      id: i.id,
      storageKey: i.storage_key,
      sortOrder: i.sort_order,
      ...(i.modification_id && { modificationId: i.modification_id }),
      alt,
      overrides,
    };
  });
}

/** Діти агрегата для `products.get`: модифікації, значення властивостей, зображення. */
export async function loadChildren(
  db: ActorDb,
  productId: string,
  primary: string,
): Promise<ChildrenOut> {
  return {
    modifications: await loadModifications(db, productId, primary),
    propertyValues: await loadPropertyValues(db, productId, primary),
    images: await loadImages(db, productId, primary),
  };
}
