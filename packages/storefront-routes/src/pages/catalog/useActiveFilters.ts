// Бейджі активних фільтрів і їх зняття (контракт тем v3, Фаза 4).

import { useCallback, useMemo } from 'react';
import { useT } from '@simplycms/i18n';
import {
  buildActiveFilterChips,
  type ChipSources,
  type PropertyOptionRow,
} from './active-filter-chips';
import type { CatalogFiltersState } from './types';

export type { PropertyOptionRow };

interface UseActiveFiltersOptions extends ChipSources {
  filters: CatalogFiltersState;
  setFilters: (filters: CatalogFiltersState) => void;
}

/** Список бейджів активних фільтрів + обробники їх зняття. */
export function useActiveFilters({
  filters,
  setFilters,
  priceRange,
  numericRanges,
  numericProperties,
  propertyOptions,
}: UseActiveFiltersOptions) {
  const t = useT();

  const chips = useMemo(
    () =>
      buildActiveFilterChips(filters, t, {
        priceRange,
        numericRanges,
        numericProperties,
        propertyOptions,
      }),
    [filters, t, priceRange, numericRanges, numericProperties, propertyOptions],
  );

  const onRemoveFilter = useCallback(
    (filter: { key: string; type: string; optionId?: string }) => {
      const next = { ...filters };

      if (filter.type === 'price') {
        delete next.priceMin;
        delete next.priceMax;
      } else if (filter.type === 'range') {
        delete next[`${filter.key}Min`];
        delete next[`${filter.key}Max`];
      } else if (filter.type === 'option' && filter.optionId) {
        const current = (next[filter.key] as string[]) || [];
        const updated = current.filter((id) => id !== filter.optionId);
        if (updated.length > 0) {
          next[filter.key] = updated;
        } else {
          delete next[filter.key];
        }
      }

      setFilters(next);
    },
    [filters, setFilters],
  );

  const onClearAll = useCallback(() => setFilters({}), [setFilters]);

  return { chips, onRemoveFilter, onClearAll };
}
