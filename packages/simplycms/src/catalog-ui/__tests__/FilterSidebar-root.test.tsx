// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { getSectionFilters } from 'simplycms/core/lib/section-filters';
import { FilterSidebar } from '../FilterSidebar';

vi.mock('simplycms/core/lib/section-filters', () => ({
  getSectionFilters: vi.fn(async () => ({
    properties: [
      {
        id: 'p-type',
        name: 'Тип панелі',
        slug: 'panel-type',
        property_type: 'select',
        is_filterable: true,
      },
      {
        id: 'p-wifi',
        name: 'Wi-Fi',
        slug: 'has-wifi',
        property_type: 'boolean',
        is_filterable: true,
      },
    ],
    optionsByProperty: {
      'p-type': [
        {
          id: 'o-mono',
          property_id: 'p-type',
          name: 'Монокристалічна',
          slug: 'mono',
          sort_order: 1,
          section_properties: null,
        },
      ],
    },
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSidebar(
  props: Partial<React.ComponentProps<typeof FilterSidebar>> = {},
) {
  const onFilterChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">
        <FilterSidebar
          filters={{}}
          onFilterChange={onFilterChange}
          {...props}
        />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return onFilterChange;
}

describe('FilterSidebar без розділу (корінь каталогу)', () => {
  it('рендерить заголовок і властивості з серверного виклику без sectionId', async () => {
    renderSidebar();

    expect(screen.getByText('Фільтри')).toBeTruthy();
    expect(await screen.findByText('Тип панелі')).toBeTruthy();
    expect(screen.getByText('Монокристалічна')).toBeTruthy();
    expect(screen.getByText('Wi-Fi')).toBeTruthy();
    expect(getSectionFilters).toHaveBeenCalledWith({ data: {} });
  });

  it('клік по Radix-чекбоксу «лише в наявності» змінює фільтри', async () => {
    const onFilterChange = renderSidebar();

    const box = await screen.findByRole('checkbox', {
      name: 'Тільки в наявності',
    });
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);

    expect(onFilterChange).toHaveBeenCalledWith({ inStockOnly: true });
  });

  it('клік по опції викликає зміну з id опції', async () => {
    const onFilterChange = renderSidebar();

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /Монокристалічна/ }),
    );

    expect(onFilterChange).toHaveBeenCalledWith({
      'panel-type': ['o-mono'],
    });
  });

  it('проп renderCheckbox теми має пріоритет над simplycms/ui', async () => {
    renderSidebar({
      renderCheckbox: (props) => (
        <input
          type="checkbox"
          data-testid="theme-checkbox"
          id={String(props.id)}
          checked={props.checked === true}
          onChange={(e) =>
            (props.onCheckedChange as (v: boolean) => void)(e.target.checked)
          }
        />
      ),
    });

    await screen.findByText('Тип панелі');
    expect(screen.getAllByTestId('theme-checkbox').length).toBe(3);
    expect(screen.queryAllByRole('checkbox').length).toBe(3);
    expect(document.querySelector('button[role="checkbox"]')).toBeNull();
  });
});
