// Сітка каталогу на справжньому `usePricedProducts` — без контролера
// сторінки з його фільтрами й рейтингами, яких картка не потребує.

import type { RawCatalogProduct } from '../../catalog/useCatalogProductsQuery';
import { usePricedProducts } from '../../catalog/usePricedProducts';
import { CatalogProductGrid } from '../../../views/slots/CatalogProductGrid';

export function CatalogCards({ rows }: { rows: RawCatalogProduct[] }) {
  const { products, isLoading } = usePricedProducts(rows);
  return (
    <CatalogProductGrid
      ssrItems={[]}
      products={products}
      isLoading={isLoading}
      viewMode="grid"
      onResetFilters={() => {}}
    />
  );
}
