import { resolvePrice, type PriceEntry } from "@simplycms/domain/pricing";

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

/** Модифікація товару в рядку select-у списку. */
interface ProductListRowModification {
  id: string;
  is_default?: boolean | null;
  sort_order?: number | null;
}

/** Рядок select-у списку товарів (форма PRODUCT_LIST_SELECT). */
export interface ProductListRow {
  id: string;
  slug: string;
  name: string;
  images?: unknown;
  has_modifications?: boolean | null;
  sections?: { slug?: string | null } | null;
  product_modifications?: ProductListRowModification[] | null;
  product_prices?: PriceEntry[] | null;
}

/** Модифікація за замовчуванням: явний прапорець, інакше — найменший sort_order. */
function pickDefaultModification(
  mods: ProductListRowModification[],
): ProductListRowModification | null {
  if (mods.length === 0) return null;
  const flagged = mods.find((m) => m.is_default);
  if (flagged) return flagged;
  return [...mods].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )[0];
}

/** Перше зображення товару з jsonb-масиву `images`. */
function pickFirstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first: unknown = images[0];
  return typeof first === "string" && first.length > 0 ? first : null;
}

/**
 * Мапить рядок select-у в DTO для SSR-списку. Ціну обирає доменна
 * `resolvePrice` — та сама семантика, що на клієнті (Catalog.tsx), без
 * дублювання логіки: спершу ціни default-модифікації, інакше ціна продукту.
 */
export function toProductListItem(
  row: ProductListRow,
  ctx: PriceContext,
): ProductListItem {
  const hasModifications = row.has_modifications ?? true;
  const defaultMod = hasModifications
    ? pickDefaultModification(row.product_modifications ?? [])
    : null;

  const { price } = resolvePrice(
    row.product_prices ?? [],
    ctx.defaultPriceTypeId,
    ctx.defaultPriceTypeId,
    defaultMod?.id ?? null,
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: pickFirstImage(row.images),
    price,
    sectionSlug: row.sections?.slug ?? null,
  };
}
