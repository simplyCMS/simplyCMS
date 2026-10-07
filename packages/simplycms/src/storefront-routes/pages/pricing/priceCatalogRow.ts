// Рядок вибірки каталогу → картка з ціною середовища (каталог, розділ і
// сторінка значення характеристики беруть ту саму вибірку).

import type { DiscountEnvironment, StockStatus } from 'simplycms/contracts';
import type { CatalogProductRow } from 'simplycms/storefront/loaders';
import { cardPrice, type CardPrice } from './priceForCard';

export type PricedCatalogRow<T extends CatalogProductRow> = Omit<
  T,
  'stock_status'
> &
  CardPrice & { stock_status: StockStatus };

/**
 * Ціна — з модифікації за замовчуванням (товар із модифікаціями) або з
 * самого товару; розділ — з приєднаної гілки, інакше з поля рядка.
 */
export function priceCatalogRow<T extends CatalogProductRow>(
  row: T,
  env: DiscountEnvironment,
): PricedCatalogRow<T> {
  const defaultMod = row.has_modifications
    ? (row.modifications[0] ?? null)
    : null;
  const stockStatus = row.has_modifications
    ? (defaultMod?.stock_status ?? 'in_stock')
    : (row.stock_status ?? 'in_stock');
  return {
    ...row,
    ...cardPrice(row.product_prices, env, {
      productId: row.id,
      modificationId: defaultMod?.id ?? null,
      sectionId: row.section?.id ?? row.section_id ?? null,
    }),
    stock_status: stockStatus,
  };
}
