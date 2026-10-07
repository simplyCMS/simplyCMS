import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { CATALOG_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { ProductCard } from 'simplycms/core/components/catalog/ProductCard';
import { Button } from 'simplycms/ui/button';
import { cn } from 'simplycms/ui/utils';
import { PricesFailure } from '../../components/PricesFailure';
import { SsrProductGrid } from '../../components/SsrProductGrid';
import type { ProductListItem } from '../../server/product-list-item';
import type { CatalogViewMode } from './CatalogToolbarSlots';

type CardProduct = ComponentProps<typeof ProductCard>['product'];
type CardRating = ComponentProps<typeof ProductCard>['rating'];

export interface CatalogProductGridProps {
  className?: string;
  /** Серверний список: рендериться, доки не приїхали клієнтські дані. */
  ssrItems: ProductListItem[];
  /** Відфільтрована вибірка; `undefined` — клієнтських даних ще немає. */
  products: CardProduct[] | undefined;
  isLoading: boolean;
  /** Середовище цін не завантажилось: замість сітки — помилка з повтором. */
  pricesFailed?: boolean;
  onRetryPrices?: () => void;
  viewMode: CatalogViewMode;
  ratings?: Record<string, CardRating>;
  /** Скидання фільтрів із порожньої вибірки. */
  onResetFilters: () => void;
}

const GRID_CLASS = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4';

/**
 * Реквізит «сітка товарів» — разом із усіма своїми станами: серверний
 * список, завантаження, збій цін, вибірка й порожній результат. Стани належать ядру
 * саме тому, що на них тримається перехід SSR → клієнт: тема, яка намалює
 * власну сітку без них, показала б порожню сторінку до першого фетчу.
 */
export function CatalogProductGrid({
  className,
  ssrItems,
  products,
  isLoading,
  pricesFailed = false,
  onRetryPrices,
  viewMode,
  ratings,
  onResetFilters,
}: CatalogProductGridProps) {
  const t = useT();

  return (
    <div
      data-simplycms-requisite={CATALOG_REQUISITES.ProductGrid}
      className={cn('contents', className)}
    >
      {pricesFailed && onRetryPrices ? (
        <PricesFailure onRetry={onRetryPrices} className="py-12" />
      ) : !products && ssrItems.length > 0 ? (
        <SsrProductGrid items={ssrItems} viewMode={viewMode} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products && products.length > 0 ? (
        <div
          className={viewMode === 'grid' ? GRID_CLASS : 'flex flex-col gap-4'}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              rating={ratings?.[product.id]}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('catalog.noResults')}</p>
          <Button variant="outline" onClick={onResetFilters}>
            {t('catalog.resetFilters')}
          </Button>
        </div>
      )}
    </div>
  );
}
