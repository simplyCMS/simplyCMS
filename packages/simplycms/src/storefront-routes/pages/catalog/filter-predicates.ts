// Предикати фільтрів вибірки каталогу (контракт тем v3, Фаза 4).
// Чисті функції «товар × стан фільтрів → чи лишається товар у вибірці».

import type { CatalogFiltersState, NumericProperty } from './types';

/** Мінімум полів товару, потрібний фільтрам і сортуванню. */
export interface FilterableProduct {
  price: number | null;
  created_at: string;
  isAvailable: boolean;
  section: { id: string } | null;
  propertyValues: Array<{
    property_id: string;
    numeric_value: number | null;
    option_id: string | null;
  }>;
}

/** Фільтри-діапазони числових характеристик. */
export function matchesNumericFilters(
  product: FilterableProduct,
  filters: CatalogFiltersState,
  numericProperties: NumericProperty[] | undefined,
): boolean {
  return (numericProperties ?? []).every((prop) => {
    const minVal = filters[`${prop.slug}Min`];
    const maxVal = filters[`${prop.slug}Max`];
    if (minVal === undefined && maxVal === undefined) return true;

    // Значення можуть прийти з кількох модифікацій — досить одного влучання;
    // товар без цієї характеристики з вибірки випадає.
    const matching = product.propertyValues.filter(
      (pv) => pv.property_id === prop.id && pv.numeric_value !== null,
    );
    if (matching.length === 0) return false;

    return matching.some((pv) => {
      const val = pv.numeric_value;
      if (val === null) return false;
      if (minVal !== undefined && val < (minVal as number)) return false;
      if (maxVal !== undefined && val > (maxVal as number)) return false;
      return true;
    });
  });
}

/** Фільтри-опції (мультивибір за `option_id`). */
export function matchesOptionFilters(
  product: FilterableProduct,
  filters: CatalogFiltersState,
): boolean {
  return Object.entries(filters).every(([key, value]) => {
    if (key === 'priceMin' || key === 'priceMax' || key === 'inStockOnly')
      return true;
    if (key.endsWith('Min') || key.endsWith('Max')) return true;
    if (!value || (Array.isArray(value) && value.length === 0)) return true;

    return product.propertyValues.some((pv) => {
      if (!pv.option_id || !Array.isArray(value)) return false;
      // Мультивибір зберігає кілька option_id через кому.
      const productOptionIds = pv.option_id.split(',').filter(Boolean);
      return productOptionIds.some((id: string) => value.includes(id));
    });
  });
}

/** Фільтр ціни; товар без ціни ним не відсіюється. */
export function matchesPriceFilter(
  product: FilterableProduct,
  filters: CatalogFiltersState,
): boolean {
  const { priceMin, priceMax } = filters;
  if (priceMin === undefined && priceMax === undefined) return true;
  if (product.price === null || product.price === undefined) return true;
  if (priceMin !== undefined && product.price < (priceMin as number))
    return false;
  if (priceMax !== undefined && product.price > (priceMax as number))
    return false;
  return true;
}
