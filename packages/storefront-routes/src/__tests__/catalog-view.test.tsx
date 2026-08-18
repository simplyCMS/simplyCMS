// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@simplycms/i18n';
import {
  CATALOG_REQUISITES,
  REQUIRED_REQUISITES,
  type CatalogSlots,
} from '@simplycms/objects/views';
import {
  catalogViewModelFixtures,
  catalogSectionViewModelFixtures,
} from '@simplycms/objects/views/fixtures';

/**
 * Conformance-прогін канонічних `CatalogView` і `CatalogSectionView` на
 * фікстурах (контракт тем v3, Фаза 4, Step 2) — до появи kit-а Фази 6.
 *
 * 🔴 Це водночас ДОКАЗ чистоти обох view: провайдер тут рівно один — i18n.
 * Ні supabase-клієнта, ні QueryClient, ні EngineContext немає, тож будь-який
 * запит усередині view впав би тут, а не в проді.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { CatalogView } from '../views/CatalogView';
import { CatalogSectionView } from '../views/CatalogSectionView';

/** Стаб реквізиту: тільки маркер — рівно те, що шукатиме kit Фази 6. */
function requisiteStub(name: string) {
  return function RequisiteStub() {
    return <div data-simplycms-requisite={name} />;
  };
}

const stubSlots: CatalogSlots = {
  SectionChips: requisiteStub(CATALOG_REQUISITES.SectionChips),
  Filters: requisiteStub(CATALOG_REQUISITES.Filters),
  SortSelect: requisiteStub(CATALOG_REQUISITES.SortSelect),
  ViewModeToggle: requisiteStub(CATALOG_REQUISITES.ViewModeToggle),
  ActiveFilters: requisiteStub(CATALOG_REQUISITES.ActiveFilters),
  ProductGrid: requisiteStub(CATALOG_REQUISITES.ProductGrid),
};

function renderCatalog(state: 'full' | 'edge') {
  return render(
    <I18nProvider locale="uk">
      <CatalogView {...catalogViewModelFixtures[state]} slots={stubSlots} />
    </I18nProvider>,
  );
}

function renderSection(state: 'full' | 'edge') {
  return render(
    <I18nProvider locale="uk">
      <CatalogSectionView
        {...catalogSectionViewModelFixtures[state]}
        slots={stubSlots}
      />
    </I18nProvider>,
  );
}

function requisitesOf(container: HTMLElement): (string | null)[] {
  return Array.from(
    container.querySelectorAll('[data-simplycms-requisite]'),
  ).map((node) => node.getAttribute('data-simplycms-requisite'));
}

describe('CatalogView — канонічний view на фікстурах', () => {
  afterEach(cleanup);

  it('повний стан: заголовок каталогу й лічильник товарів у розмітці', () => {
    const { container } = renderCatalog('full');

    expect(container.querySelector('h1')?.textContent).toBe('Каталог');
    expect(container.textContent).toContain('24');
  });

  it('повний стан: крихти — лінк на головну, остання ланка текстом', () => {
    const { container } = renderCatalog('full');

    const links = Array.from(container.querySelectorAll('nav a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/']);
    expect(container.querySelector('nav span')?.textContent).toBe('Каталог');
  });

  it.each(['full', 'edge'] as const)(
    'стан %s: усі обовʼязкові реквізити розставлені',
    (state) => {
      const { container } = renderCatalog(state);

      expect(requisitesOf(container)).toEqual(
        expect.arrayContaining([...REQUIRED_REQUISITES.Catalog]),
      );
    },
  );

  it('крайній стан: порожня вибірка рендериться з нулем у лічильнику', () => {
    const { container } = renderCatalog('edge');

    expect(container.textContent).toContain('0');
  });
});

describe('CatalogSectionView — канонічний view на фікстурах', () => {
  afterEach(cleanup);

  it('повний стан: назва розділу в шапці, опис — HTML-блоком під вибіркою', () => {
    const { container } = renderSection('full');
    const vm = catalogSectionViewModelFixtures.full;

    expect(container.querySelector('h1')?.textContent).toBe(vm.section.name);
    expect(container.innerHTML).toContain('Сонячні панелі для дому й бізнесу.');
    expect(container.querySelector('h2')?.textContent).toBe(vm.section.name);
  });

  it('повний стан: крихти ведуть на головну й у каталог', () => {
    const { container } = renderSection('full');

    const links = Array.from(container.querySelectorAll('nav a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/catalog']);
  });

  it.each(['full', 'edge'] as const)(
    'стан %s: усі обовʼязкові реквізити розставлені',
    (state) => {
      const { container } = renderSection(state);

      expect(requisitesOf(container)).toEqual(
        expect.arrayContaining([...REQUIRED_REQUISITES.CatalogSection]),
      );
    },
  );

  it('крайній стан: порожня секція без опису — блок опису відсутній', () => {
    const { container } = renderSection('edge');

    expect(container.querySelector('h1')?.textContent).toBe('Порожня секція');
    expect(container.querySelector('h2')).toBeNull();
    expect(container.querySelector('.prose')).toBeNull();
  });
});
