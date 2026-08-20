// Спільні типи контейнерів каталогу (контракт тем v3, Фаза 4).
//
// Каталог і сторінка розділу — та сама механіка вибірки (запит → ціни →
// фільтри → сортування), тому типи, хуки й підкомпоненти view у них СПІЛЬНІ,
// а розходження зведені до параметрів.

import type { FilterValue } from '@simplycms/core/components/catalog/FilterSidebar';

export type { FilterValue };

/** Стан панелі фільтрів: ключ характеристики → обране значення. */
export type CatalogFiltersState = Record<string, FilterValue>;

/** Значення характеристики товару у вибірці каталогу. */
export interface CatalogPropertyValue {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
}

/** Числова характеристика розділу, придатна для фільтра-діапазону. */
export interface NumericProperty {
  id: string;
  slug: string;
  property_type: string;
  is_filterable: boolean;
}

/** Межі числового діапазону поточної вибірки. */
export interface NumericRange {
  min: number;
  max: number;
}

/** Діапазони числових характеристик: slug характеристики → межі. */
export type NumericRanges = Record<string, NumericRange>;

/** Бейдж активного фільтра — форма `ActiveFilters` ядра. */
export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
  type: 'option' | 'range' | 'price';
  optionId?: string;
}
