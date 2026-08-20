// Контейнерна логіка каталогу — спільна для каталогу й сторінки розділу
// (контракт тем v3, Фаза 4).

import { useCallback, useMemo, useState } from 'react';
import { useProductRatings } from 'simplycms/core/hooks/useProductReviews';
import type { ProductListItem } from '../../server/product-list-item';
import type {
  CatalogSortOption,
  CatalogViewMode,
} from '../../views/slots/CatalogToolbarSlots';
import {
  computeNumericRanges,
  computePriceRange,
  filterAndSortProducts,
  filterBySection,
} from './filtering';
import type { CatalogBindings } from './slot-context';
import type { CatalogFiltersState } from './types';
import { useActiveFilters } from './useActiveFilters';
import { useCatalogProductsQuery } from './useCatalogProductsQuery';
import {
  useNumericPropertiesQuery,
  usePropertyOptionsQuery,
  useSectionsQuery,
  type CatalogSectionRow,
} from './useCatalogQueries';
import { usePricedProducts } from './usePricedProducts';

export interface CatalogControllerOptions {
  /**
   * Сторінка розділу: вибірка звужена запитом. `undefined` — сторінка
   * каталогу (розділ обирається чипсами на клієнті), `null` — сторінка
   * розділу, розділ якої ще не приїхав.
   */
  sectionId?: string | null;
  initialSections?: CatalogSectionRow[];
  initialProducts?: ProductListItem[];
}

export interface CatalogController {
  /** Підпис панелі інструментів: скільки товарів у поточній вибірці. */
  productCount: number;
  bindings: CatalogBindings;
}

export function useCatalogController({
  sectionId,
  initialSections,
  initialProducts,
}: CatalogControllerOptions = {}): CatalogController {
  const [filters, setFilters] = useState<CatalogFiltersState>({});
  const [sortBy, setSortBy] = useState<CatalogSortOption>('popular');
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );

  /** Сторінка розділу — вибірка вже звужена запитом, чипси ведуть лінками. */
  const scoped = sectionId !== undefined;
  const activeSectionId = scoped ? (sectionId ?? null) : selectedSectionId;

  /** Серверний список: рендериться в SSR-HTML і в першому клієнтському
   *  рендері, доки React Query не поверне збагачені дані. */
  const ssrProducts = initialProducts ?? [];

  const { data: sections } = useSectionsQuery(initialSections);
  const { data: rawProducts, isLoading: productsLoading } =
    useCatalogProductsQuery(sectionId);
  const products = usePricedProducts(rawProducts);
  const { data: numericProperties } =
    useNumericPropertiesQuery(activeSectionId);
  const { data: propertyOptions } = usePropertyOptionsQuery();

  const ratingProductIds = useMemo(
    () => products?.map((p) => p.id) || [],
    [products],
  );
  const { data: ratingsData } = useProductRatings(ratingProductIds);

  const priceRange = useMemo(() => computePriceRange(products), [products]);
  const numericRanges = useMemo(
    () => computeNumericRanges(products, numericProperties, activeSectionId),
    [products, numericProperties, activeSectionId],
  );
  const filteredProducts = useMemo(
    () =>
      filterAndSortProducts(products, {
        filters,
        sortBy,
        sectionId: activeSectionId,
        numericProperties,
      }),
    [products, filters, sortBy, activeSectionId, numericProperties],
  );
  const sectionProducts = useMemo(
    () => filterBySection(products, activeSectionId),
    [products, activeSectionId],
  );

  const { chips, onRemoveFilter, onClearAll } = useActiveFilters({
    filters,
    setFilters,
    priceRange,
    numericRanges,
    numericProperties,
    propertyOptions,
  });

  /** Перемикання чипса скидає фільтри: вони належать попередньому розділу. */
  const onSelectSection = useCallback((next: string | null) => {
    setSelectedSectionId(next);
    setFilters({});
  }, []);

  const bindings: CatalogBindings = {
    chips: scoped
      ? { mode: 'link', sections: sections ?? [], activeId: sectionId ?? '' }
      : {
          mode: 'filter',
          sections: sections ?? [],
          selectedId: selectedSectionId,
          onSelect: onSelectSection,
        },
    filters: {
      sectionId: activeSectionId || undefined,
      filters,
      onFilterChange: setFilters,
      priceRange,
      numericPropertyRanges: numericRanges,
      products: sectionProducts,
    },
    sort: { value: sortBy, onChange: setSortBy },
    viewMode: { value: viewMode, onChange: setViewMode },
    activeFilters: { filters: chips, onRemoveFilter, onClearAll },
    grid: {
      ssrItems: ssrProducts,
      products: products ? filteredProducts : undefined,
      isLoading: productsLoading,
      viewMode,
      ratings: ratingsData,
      onResetFilters: onClearAll,
    },
  };

  return {
    productCount: products ? filteredProducts.length : ssrProducts.length,
    bindings,
  };
}
