// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CATALOG_REQUISITES, HOME_REQUISITES } from 'simplycms/contracts/views';

type LinkMockProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  to: string;
  params?: unknown;
};

// Мок роутера прокидає решту пропсів на <a> — інакше маркер реквізиту,
// який `asChild` зливає в дочірній лінк, губився б у самому моці.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _params, ...rest }: LinkMockProps) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
// Панель фільтрів і карусель роблять власні запити — тут перевіряється
// внесок САМОГО слота: маркер і прокидання пропсів усередину.
vi.mock('simplycms/core/components/catalog/FilterSidebar', () => ({
  FilterSidebar: () => <div data-testid="filter-sidebar" />,
}));
vi.mock('../pages/home/SectionProductCarousel', () => ({
  SectionProductCarousel: ({ section }: { section: { name: string } }) => (
    <div data-testid="carousel">{section.name}</div>
  ),
}));

import { SlotHarness, requisite } from './slots-harness';
import { CatalogFilters } from '../views/slots/CatalogFilters';
import { CatalogProductGrid } from '../views/slots/CatalogProductGrid';
import { CatalogFilterChips } from '../views/slots/CatalogSectionChips';
import {
  CatalogActiveFilters,
  CatalogSortSelect,
  CatalogViewModeToggle,
} from '../views/slots/CatalogToolbarSlots';
import { HomeSectionCarousel } from '../views/slots/HomeSectionCarousel';

const product = {
  id: 'prod-1',
  name: 'Item A',
  slug: 'item-a',
  section: { slug: 'sec' },
  price: 4200,
};

const ssrItem = {
  id: 'prod-2',
  name: 'Item B',
  slug: 'item-b',
  imageUrl: null,
  sectionSlug: 'sec',
  price: 999,
};

const gridProps = {
  ssrItems: [],
  products: undefined,
  isLoading: false,
  viewMode: 'grid' as const,
  onResetFilters: () => {},
};

function draw(node: ReactNode): HTMLElement {
  return render(<SlotHarness>{node}</SlotHarness>).container;
}

/** Юніти реквізитів каталогу й головної (Фаза 2, Step 3). */
describe('slot-компоненти каталогу', () => {
  afterEach(cleanup);

  it('маркери простих реквізитів панелі', () => {
    const container = draw(
      <>
        <CatalogFilterChips
          sections={[]}
          selectedId={null}
          onSelect={() => {}}
        />
        <CatalogSortSelect value="popular" onChange={() => {}} />
        <CatalogViewModeToggle value="grid" onChange={() => {}} />
        <CatalogActiveFilters
          filters={[]}
          onRemoveFilter={() => {}}
          onClearAll={() => {}}
        />
        <CatalogFilters filters={{}} onFilterChange={() => {}} />
      </>,
    );

    for (const name of [
      CATALOG_REQUISITES.SectionChips,
      CATALOG_REQUISITES.SortSelect,
      CATALOG_REQUISITES.ViewModeToggle,
      CATALOG_REQUISITES.ActiveFilters,
      CATALOG_REQUISITES.Filters,
    ]) {
      expect(requisite(container, name), name).not.toBeNull();
    }
  });

  it('CatalogProductGrid: серверний список, доки немає клієнтських даних', () => {
    const container = draw(
      <CatalogProductGrid {...gridProps} ssrItems={[ssrItem]} />,
    );

    expect(requisite(container, CATALOG_REQUISITES.ProductGrid)).not.toBeNull();
    expect(container.textContent).toContain('Item B');
  });

  it('CatalogProductGrid: стан завантаження', () => {
    const container = draw(<CatalogProductGrid {...gridProps} isLoading />);

    expect(requisite(container, CATALOG_REQUISITES.ProductGrid)).not.toBeNull();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('CatalogProductGrid: вибірка товарів', () => {
    const container = draw(
      <CatalogProductGrid {...gridProps} products={[product]} />,
    );

    expect(container.textContent).toContain('Item A');
  });

  it('CatalogProductGrid: порожня вибірка — кнопка скидання фільтрів', () => {
    const container = draw(<CatalogProductGrid {...gridProps} products={[]} />);

    expect(requisite(container, CATALOG_REQUISITES.ProductGrid)).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('HomeSectionCarousel: маркер поверх канонічної каруселі', () => {
    const container = draw(
      <HomeSectionCarousel
        section={{ id: 'sec-1', name: 'Section A', slug: 'sec-a' }}
      />,
    );

    expect(
      requisite(container, HOME_REQUISITES.SectionCarousel),
    ).not.toBeNull();
    expect(container.textContent).toContain('Section A');
  });
});
