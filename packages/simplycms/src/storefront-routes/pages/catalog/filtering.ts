// Чиста вибірка каталогу: розділ, фільтри, сортування, похідні діапазони
// (контракт тем v3, Фаза 4). Без хуків і без запитів — логіка вибірки
// перевіряється окремо від UI і спільна для каталогу й сторінки розділу.

import type { CatalogSortOption } from '../../views/slots/CatalogToolbarSlots';
import {
  matchesNumericFilters,
  matchesOptionFilters,
  matchesPriceFilter,
  type FilterableProduct,
} from './filter-predicates';
import type {
  CatalogFiltersState,
  NumericProperty,
  NumericRange,
  NumericRanges,
} from './types';

export type { FilterableProduct };

export interface FilterAndSortOptions {
  filters: CatalogFiltersState;
  sortBy: CatalogSortOption;
  /** Розділ поточної вибірки; `null` — усі товари. */
  sectionId: string | null;
  numericProperties: NumericProperty[] | undefined;
}

/** Межі цін вибірки — початкові значення слайдера фільтра. */
export function computePriceRange<T extends { price: number | null }>(
  products: T[] | undefined,
): NumericRange | undefined {
  if (!products?.length) return undefined;
  const prices = products
    .map((p) => p.price)
    .filter((p): p is number => typeof p === 'number');
  if (prices.length === 0) return undefined;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Товари поточного розділу; без розділу — вибірка цілком. */
export function filterBySection<T extends { section: { id: string } | null }>(
  products: T[] | undefined,
  sectionId: string | null,
): T[] | undefined {
  if (!products || !sectionId) return products;
  return products.filter((p) => p.section?.id === sectionId);
}

/** Межі числових характеристик по товарах поточного розділу. */
export function computeNumericRanges<T extends FilterableProduct>(
  products: T[] | undefined,
  numericProperties: NumericProperty[] | undefined,
  sectionId: string | null,
): NumericRanges {
  if (!products?.length || !numericProperties?.length) return {};

  const relevant = filterBySection(products, sectionId) ?? [];
  const ranges: NumericRanges = {};

  numericProperties.forEach((prop) => {
    const values: number[] = [];
    relevant.forEach((product) => {
      product.propertyValues.forEach((pv) => {
        if (pv.property_id === prop.id && pv.numeric_value !== null) {
          values.push(pv.numeric_value);
        }
      });
    });

    if (values.length > 0) {
      ranges[prop.slug] = {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  });

  return ranges;
}

/** Сортування вибірки; `popular` — порядок джерела. */
function sortProducts<T extends FilterableProduct>(
  products: T[],
  sortBy: CatalogSortOption,
): T[] {
  switch (sortBy) {
    case 'price_asc':
      return products.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_desc':
      return products.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'newest':
      return products.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    default:
      return products;
  }
}

/** Вибірка після всіх фільтрів і сортування. */
export function filterAndSortProducts<T extends FilterableProduct>(
  products: T[] | undefined,
  { filters, sortBy, sectionId, numericProperties }: FilterAndSortOptions,
): T[] {
  if (!products) return [];

  const result = (filterBySection(products, sectionId) ?? []).filter(
    (product) =>
      (!filters.inStockOnly || product.isAvailable) &&
      matchesOptionFilters(product, filters) &&
      matchesNumericFilters(product, filters, numericProperties) &&
      matchesPriceFilter(product, filters),
  );

  return sortProducts(result, sortBy);
}
