import { resolvePrice } from 'simplycms/domain/pricing';
import type {
  ProductListModification,
  ProductListRow,
} from 'simplycms/storefront/loaders';

export type { ProductListRow };

/**
 * Контекст цін для серверного резолву. SSR рендериться анонімно, тож ціни
 * рахуються за типом ціни «за замовчуванням»; персональний тип користувача
 * доклеює клієнт (usePriceType) під час збагачення списку.
 */
export interface PriceContext {
  defaultPriceTypeId: string | null;
}

/** Мінімальний DTO товару для серверного рендеру списку каталогу. */
export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number | null;
  /** Slug секції — потрібен для коректного href картки в серверному HTML. */
  sectionSlug: string | null;
}

/** Список товарів для SSR разом із контекстом цін — одним раундтрипом. */
export interface ProductListPayload {
  items: ProductListItem[];
  priceContext: PriceContext;
}

/** Модифікація за замовчуванням: явний прапорець, інакше — найменший sort_order. */
function pickDefaultModification(
  mods: ProductListModification[],
): ProductListModification | null {
  if (mods.length === 0) return null;
  const flagged = mods.find((m) => m.is_default);
  if (flagged) return flagged;
  return [...mods].sort((a, b) => a.sort_order - b.sort_order)[0];
}

/**
 * Мапить рядок вибірки в DTO для SSR-списку. Ціну обирає доменна
 * `resolvePrice` — та сама семантика, що на клієнті (Catalog.tsx), без
 * дублювання логіки: спершу ціни default-модифікації, інакше ціна продукту.
 */
export function toProductListItem(
  row: ProductListRow,
  ctx: PriceContext,
): ProductListItem {
  const hasModifications = row.has_modifications ?? true;
  const defaultMod = hasModifications
    ? pickDefaultModification(row.product_modifications)
    : null;

  const { price } = resolvePrice(
    row.product_prices,
    ctx.defaultPriceTypeId,
    ctx.defaultPriceTypeId,
    defaultMod?.id ?? null,
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.images[0] ?? null,
    price,
    sectionSlug: row.sections?.slug ?? null,
  };
}

/** Мапить рядки списку в DTO за СПІЛЬНИМ контекстом цін (він один на сторінку). */
export function toProductListPayload(
  rows: ProductListRow[],
  defaultPriceTypeId: string | null,
): ProductListPayload {
  const priceContext: PriceContext = { defaultPriceTypeId };

  return {
    items: rows.map((row) => toProductListItem(row, priceContext)),
    priceContext,
  };
}
