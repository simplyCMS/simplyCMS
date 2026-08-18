// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@simplycms/i18n';
import {
  PRODUCT_DETAIL_REQUISITES,
  REQUIRED_REQUISITES,
  type ProductDetailSlots,
} from '@simplycms/objects/views';
import { productDetailViewModelFixtures } from '@simplycms/objects/views/fixtures';

/**
 * Conformance-прогін канонічного `ProductDetailView` на фікстурах
 * (контракт тем v3, Фаза 3, Step 2) — до появи kit-а Фази 6.
 *
 * 🔴 Це водночас ДОКАЗ чистоти view: провайдер тут рівно один — i18n.
 * Ні supabase-клієнта, ні QueryClient, ні EngineContext немає, тож будь-який
 * фетч усередині view впав би тут, а не в проді.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { ProductDetailView } from '../views/ProductDetailView';

/** Стаб реквізиту: тільки маркер — рівно те, що шукатиме kit Фази 6. */
function requisiteStub(name: string) {
  return function RequisiteStub() {
    return <div data-simplycms-requisite={name} />;
  };
}

const stubSlots: ProductDetailSlots = {
  PluginBefore: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginBefore),
  StockBadge: requisiteStub(PRODUCT_DETAIL_REQUISITES.StockBadge),
  PluginBadges: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginBadges),
  PriceBlock: requisiteStub(PRODUCT_DETAIL_REQUISITES.PriceBlock),
  ModificationSelector: requisiteStub(
    PRODUCT_DETAIL_REQUISITES.ModificationSelector,
  ),
  AddToCart: requisiteStub(PRODUCT_DETAIL_REQUISITES.AddToCart),
  StockAvailability: requisiteStub(PRODUCT_DETAIL_REQUISITES.StockAvailability),
  Reviews: requisiteStub(PRODUCT_DETAIL_REQUISITES.Reviews),
  PluginAfter: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginAfter),
};

function renderView(state: 'full' | 'edge') {
  return render(
    <I18nProvider locale="uk">
      <ProductDetailView
        {...productDetailViewModelFixtures[state]}
        slots={stubSlots}
      />
    </I18nProvider>,
  );
}

describe('ProductDetailView — канонічний view на фікстурах', () => {
  afterEach(cleanup);

  it('повний стан: дані view-model потрапляють у розмітку', () => {
    const { container } = renderView('full');
    const vm = productDetailViewModelFixtures.full;

    expect(container.querySelector('h1')?.textContent).toBe(vm.summary.name);
    expect(container.textContent).toContain(vm.summary.sku);
    expect(container.textContent).toContain(vm.summary.short_description);
    expect(container.textContent).toContain('-14%');
    expect(container.innerHTML).toContain('Панель для дахових систем.');
    expect(container.textContent).toContain('Потужність, Вт');
  });

  it('повний стан: хлібні крихти — лінки, остання ланка текстом', () => {
    const { container } = renderView('full');

    const links = Array.from(container.querySelectorAll('nav a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/catalog',
      '/catalog/panels',
    ]);
    expect(links.some((a) => a.textContent === 'Панель 550 Вт')).toBe(false);
  });

  it.each(['full', 'edge'] as const)(
    'стан %s: усі обовʼязкові реквізити розставлені',
    (state) => {
      const { container } = renderView(state);

      const found = Array.from(
        container.querySelectorAll('[data-simplycms-requisite]'),
      ).map((node) => node.getAttribute('data-simplycms-requisite'));

      expect(found).toEqual(
        expect.arrayContaining([...REQUIRED_REQUISITES.ProductDetail]),
      );
    },
  );

  it('крайній стан: товар без фото, артикула й опису рендериться', () => {
    const { container } = renderView('edge');

    expect(container.querySelector('h1')?.textContent).toBe('Товар без фото');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Опис товару відсутній');
  });
});
