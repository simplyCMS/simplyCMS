// Pure-правило наявності — ЄДИНЕ місце, де вирішується «можна купити».
// Перенесено з core/hooks/useProductsWithStock; переписано К2-Е0 (Е0-3).

import type {
  ProductAvailabilityInput,
  StockStatus,
} from 'simplycms/contracts';

export type { ProductAvailabilityInput, StockData } from 'simplycms/contracts';

/**
 * 🔴 Статус — джерело правди на читанні; кількість по точках — його деталь.
 *
 * До К2-Е0 у коді жило СІМ формул: три — перенос plpgsql `get_stock_info`
 * («qty > 0 або on_order»), дві — лише статус, JSON-LD — своя, і мертва
 * `isProductAvailable` у `core/hooks/useStock` («in_stock → qty > 0»). Перша
 * дає «Немає в наявності» кожному магазину, що не веде обліку по точках (а
 * DEFAULT статусу в схемі — `in_stock`, тобто канон обіцяє протилежне).
 * Правдивість статусу при обліку тримає write-side: `createOrder` списує
 * залишок під `FOR UPDATE` і переводить статус в `out_of_stock` на нулі
 * (`storefront/loaders/order-create.ts`).
 */
export function isPurchasable(status: StockStatus | null | undefined): boolean {
  return status !== 'out_of_stock';
}

/** Значення `availability` для schema.org Offer — з того самого статусу. */
export function schemaOrgAvailability(
  status: StockStatus | null | undefined,
):
  | 'https://schema.org/InStock'
  | 'https://schema.org/BackOrder'
  | 'https://schema.org/OutOfStock' {
  if (status === 'out_of_stock') return 'https://schema.org/OutOfStock';
  if (status === 'on_order') return 'https://schema.org/BackOrder';
  return 'https://schema.org/InStock';
}

/**
 * Доступність товару: для товару з модифікаціями — доступна будь-яка
 * модифікація; для простого — статус самого товару.
 */
export function calculateProductAvailability(
  product: ProductAvailabilityInput,
): boolean {
  const mods = product.product_modifications || [];
  const hasModifications = product.has_modifications ?? true;
  if (hasModifications && mods.length > 0) {
    return mods.some((m) => isPurchasable(m.stock_status));
  }
  return isPurchasable(product.stock_status);
}

/** Збагачує товари полем isAvailable. */
export function enrichProductsWithAvailability<
  T extends ProductAvailabilityInput,
>(products: T[]): (T & { isAvailable: boolean })[] {
  return products.map((product) => ({
    ...product,
    isAvailable: calculateProductAvailability(product),
  }));
}
