import { inArray } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import type { CheckoutItemInput } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';
import type { PricingContext } from './pricing-context';
import { loadPricesByProduct } from './pricing';

/** Позиція, яку можна купити: назва, розділ (ціль знижки) і базова ціна. */
export type CatalogItem = {
  name: string;
  sectionId: string | null;
  basePrice: number;
};

/**
 * Каталожні дані позицій трьома запитами й резолвер доступності позиції.
 * `null` — позицію купити не можна.
 */
export async function loadCatalog(
  db: ActorDb,
  ctx: PricingContext,
  items: CheckoutItemInput[],
): Promise<(item: CheckoutItemInput) => CatalogItem | null> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const modIds = items
    .map((i) => i.modificationId)
    .filter((id): id is string => id !== null);
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      sectionId: products.sectionId,
      stockStatus: products.stockStatus,
      isActive: products.isActive,
    })
    .from(products)
    .where(inArray(products.id, productIds));
  const modRows = modIds.length
    ? await db
        .select({
          id: productModifications.id,
          productId: productModifications.productId,
          name: productModifications.name,
          stockStatus: productModifications.stockStatus,
        })
        .from(productModifications)
        .where(inArray(productModifications.id, modIds))
    : [];
  const prices = await loadPricesByProduct(db, productIds);
  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  const byMod = new Map(modRows.map((m) => [m.id, m]));

  /** Правила доступності — дослівно ті, що відмовляли в `priceItems` до Е6в. */
  return (item: CheckoutItemInput): CatalogItem | null => {
    const product = byProduct.get(item.productId);
    const mod = item.modificationId ? byMod.get(item.modificationId) : null;
    if (!product || !product.isActive) return null;
    if (item.modificationId && (!mod || mod.productId !== item.productId))
      return null;
    if (!isPurchasable(mod ? mod.stockStatus : product.stockStatus))
      return null;
    const { price } = resolvePrice(
      prices[item.productId] ?? [],
      ctx.priceTypeId,
      ctx.defaultPriceTypeId,
      item.modificationId,
    );
    if (price === null) return null;
    const name = mod ? `${product.name} - ${mod.name}` : product.name;
    return { name, sectionId: product.sectionId, basePrice: price };
  };
}
