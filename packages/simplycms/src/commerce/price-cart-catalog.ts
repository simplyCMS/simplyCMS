import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  catalogProductTexts,
  productModificationTranslations,
  productModifications,
  products,
} from 'simplycms/schema';
import type { CheckoutItemInput } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import type { TextLocale } from 'simplycms/domain/translations';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';
import type { PricingContext } from './pricing-context';
import { loadPricesByProduct } from './pricing';

/** Позиція, яку можна купити: назва, розділ (ціль знижки) і базова ціна. */
export type CatalogItem = {
  /** Склеєна назва `<товар> - <модифікація>`: її пише знімок `order_items.name` (М2 — двомовний). */
  name: string;
  /** Назва товару окремо — для видимого кошика (`FallbackText` по частинах). */
  productName: string;
  /** Назва модифікації окремо; `null` — позиція без модифікації. */
  modificationName: string | null;
  /** Мова назви товару, коли її узято з основної мови (fallback); `null` — мовою запиту. */
  productNameLang: string | null;
  modificationNameLang: string | null;
  sectionId: string | null;
  basePrice: number;
};

/**
 * Каталожні дані позицій трьома запитами й резолвер доступності позиції.
 * `null` — позицію купити не можна.
 *
 * 🔴 Назва позиції — мовою `text.locale` (М1: знімок `order_items.name` = назва мовою
 * запиту; двомовний знімок — М2). Товар — з проєкції `catalog_product_texts` (П7), а де
 * у мові рядка немає, — з основної; модифікація — переклад мови, інакше основної.
 * Це той самий fallback, що `withFallback`, але виражений запитом до таблиць схеми:
 * `commerce` не має права імпортувати `translations` (той самий тір), а «одне правило»
 * тут — один `coalesce(мова, основна)`.
 */
export async function loadCatalog(
  db: ActorDb,
  ctx: PricingContext,
  items: CheckoutItemInput[],
  text: TextLocale,
): Promise<(item: CheckoutItemInput) => CatalogItem | null> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const modIds = items
    .map((i) => i.modificationId)
    .filter((id): id is string => id !== null);
  const locText = alias(catalogProductTexts, 't_loc');
  const srcText = alias(catalogProductTexts, 't_src');
  const productRows = await db
    .select({
      id: products.id,
      name: sql<string | null>`coalesce(${locText.name}, ${srcText.name})`,
      locName: locText.name,
      locFallback: locText.fallbackFields,
      sectionId: products.sectionId,
      stockStatus: products.stockStatus,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(
      locText,
      and(eq(locText.productId, products.id), eq(locText.locale, text.locale)),
    )
    .leftJoin(
      srcText,
      and(eq(srcText.productId, products.id), eq(srcText.locale, text.primary)),
    )
    .where(inArray(products.id, productIds));
  const locMod = alias(productModificationTranslations, 'm_loc');
  const srcMod = alias(productModificationTranslations, 'm_src');
  const modRows = modIds.length
    ? await db
        .select({
          id: productModifications.id,
          productId: productModifications.productId,
          name: sql<string | null>`coalesce(${locMod.name}, ${srcMod.name})`,
          locName: locMod.name,
          stockStatus: productModifications.stockStatus,
        })
        .from(productModifications)
        .leftJoin(
          locMod,
          and(
            eq(locMod.modificationId, productModifications.id),
            eq(locMod.locale, text.locale),
          ),
        )
        .leftJoin(
          srcMod,
          and(
            eq(srcMod.modificationId, productModifications.id),
            eq(srcMod.locale, text.primary),
          ),
        )
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
    // Товар без рядка проєкції (немає адреси ні в мові, ні в основній) — поза вітриною,
    // куплений бути не може; модифікація без назви в обох мовах — теж несправний рядок.
    if (product.name === null || (mod && mod.name === null)) return null;
    const name = mod ? `${product.name} - ${mod.name}` : product.name;
    // Ознака fallback — з даних (рядка перекладу немає / поле порожнє), не порівнянням текстів (І37).
    const own = text.locale === text.primary;
    const productNameLang =
      !own &&
      (product.locName === null || product.locFallback?.includes('name'))
        ? text.primary
        : null;
    const modificationNameLang =
      mod && !own && mod.locName === null ? text.primary : null;
    return {
      name,
      productName: product.name,
      modificationName: mod?.name ?? null,
      productNameLang,
      modificationNameLang,
      sectionId: product.sectionId,
      basePrice: price,
    };
  };
}
