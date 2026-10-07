// Сітка каталогу на справжньому `usePricedProducts` — без контролера
// сторінки з його фільтрами й рейтингами, яких картка не потребує.

import type { RawCatalogProduct } from '../../catalog/useCatalogProductsQuery';
import { usePricedProducts } from '../../catalog/usePricedProducts';
import type { ProductListItem } from '../../../server/product-list-item';
import { CatalogProductGrid } from '../../../views/slots/CatalogProductGrid';

export function CatalogCards({
  rows,
  ssrItems = [],
}: {
  rows: RawCatalogProduct[];
  /** Серверний список сторінки — як у контролері каталогу. */
  ssrItems?: ProductListItem[];
}) {
  const { products, isLoading, pricesFailed, retryPrices } =
    usePricedProducts(rows);
  return (
    <CatalogProductGrid
      ssrItems={ssrItems}
      products={products}
      isLoading={isLoading}
      pricesFailed={pricesFailed}
      onRetryPrices={retryPrices}
      viewMode="grid"
      onResetFilters={() => {}}
    />
  );
}
