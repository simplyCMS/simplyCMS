// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { FilterSidebar } from '../../catalog-ui/FilterSidebar';
import {
  filterAndSortProducts,
  type FilterableProduct,
} from '../pages/catalog/filtering';
import { useActiveFilters } from '../pages/catalog/useActiveFilters';
import type { CatalogFiltersState } from '../pages/catalog/types';

/**
 * Ланцюг Ф2: клік «Так» у панелі → стан фільтрів → вибірка → бейдж → зняття.
 * Панель і вибірка беруть boolean-властивість з одного джерела (як у
 * контролері каталогу), тож тест ловить розрив між slug-ключем стану й
 * `property_id` значень товару.
 */
const wifi = {
  id: 'pB',
  name: 'Wi-Fi',
  slug: 'has-wifi',
  property_type: 'boolean',
  is_filterable: true,
};

vi.mock('simplycms/core/lib/section-filters', () => ({
  getSectionFilters: vi.fn(async () => ({
    properties: [wifi],
    optionsByProperty: {},
  })),
}));

function item(
  id: string,
  value: string | null,
): FilterableProduct & {
  id: string;
} {
  return {
    id,
    price: 10,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    isAvailable: true,
    section: { id: 'sec-1' },
    propertyValues: value
      ? [{ property_id: wifi.id, value, numeric_value: null, option_id: null }]
      : [],
  };
}

// Стабільна ідентичність: панель синхронізує діапазони за посиланням, тож
// свіжий `{}` на кожен рендер зациклив би її (у каталозі це useMemo).
const noRanges = {};
const products = [item('A', 'true'), item('B', 'false'), item('C', null)];

function Harness() {
  const [filters, setFilters] = useState<CatalogFiltersState>({});
  const booleanProperties = [wifi];
  const { chips, onRemoveFilter } = useActiveFilters({
    filters,
    setFilters,
    priceRange: undefined,
    numericRanges: {},
    numericProperties: [],
    booleanProperties,
    propertyOptions: [],
  });
  const result = filterAndSortProducts(products, {
    filters,
    sortBy: 'popular',
    sectionId: null,
    numericProperties: [],
    booleanProperties,
  });
  return (
    <div>
      {/* Без sectionId: корінь каталогу (sectionId у вибірці теж null). */}
      <FilterSidebar
        filters={filters}
        onFilterChange={setFilters}
        numericPropertyRanges={noRanges}
      />
      <output data-testid="result">{result.map((p) => p.id).join(',')}</output>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemoveFilter(chip)}
        >
          {`${chip.label}: ${chip.value}`}
        </button>
      ))}
    </div>
  );
}

describe('boolean-фільтр каталогу: ланцюг панель → вибірка → бейдж', () => {
  it('клік «Так» дає непорожню вибірку й бейдж; зняття бейджем повертає все', async () => {
    render(
      <I18nProvider locale="uk">
        <QueryClientProvider client={new QueryClient()}>
          <Harness />
        </QueryClientProvider>
      </I18nProvider>,
    );

    expect(screen.getByTestId('result').textContent).toBe('A,B,C');

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Так' }));

    expect(screen.getByTestId('result').textContent).toBe('A');
    const badge = screen.getByRole('button', { name: 'Wi-Fi: Так' });

    fireEvent.click(badge);

    await waitFor(() =>
      expect(screen.getByTestId('result').textContent).toBe('A,B,C'),
    );
    expect(screen.queryByRole('button', { name: 'Wi-Fi: Так' })).toBeNull();
  });
});
