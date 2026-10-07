// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { TestEngineProvider } from '../../__tests__/engine-stub';
import * as F from './support/card-fixtures';

/**
 * Усі поверхні-картки рахують ОДНИМ `priceForCard` на серверному `now`
 * (Е6в-10…Е6в-12): каталог, головна, сторінка значення характеристики й
 * блок ціни сторінки товару.
 */
const server = vi.hoisted(() => ({ getDiscountEnvironment: vi.fn() }));

vi.mock('simplycms/core/lib/discounts', () => server);
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ propertySlug: 'color', optionSlug: 'black' }),
}));
vi.mock('embla-carousel-react', () => ({ default: () => [() => {}, null] }));
vi.mock('../../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));
vi.mock('../../components/BannerSlider', () => ({ BannerSlider: () => null }));
vi.mock('../../server/home', () => ({
  getFeaturedProducts: async () => [F.homeRow],
  getNewProducts: async () => [],
  getRootSections: async () => [],
  getSectionProducts: async () => [],
}));
vi.mock('../../server/properties', () => ({
  getPropertyOption: async () => F.propertyPageData,
}));

import { priceForCard } from '../pricing/priceForCard';
import HomePage from '../Home';
import PropertyPage from '../PropertyPage';
import { CatalogCards } from './support/CatalogCards';
import { ProductPrice } from './support/ProductPrice';

const ITEM = { productId: F.PRODUCT_ID, modificationId: null, sectionId: 's1' };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage(node: ReactNode, client = newClient()) {
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>{node}</TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

/** Текст без NBSP: форматер ціни ставить U+00A0 перед символом валюти. */
const text = () => document.body.textContent?.replace(/\u00a0/g, ' ') ?? '';

const surfaces = [
  ['каталог', () => <CatalogCards rows={[F.catalogRow]} />],
  ['головна', () => <HomePage featuredProducts={[F.homeRow]} />],
  ['PropertyPage', () => <PropertyPage {...F.propertyPageData} />],
  ['сторінка товару', () => <ProductPrice product={F.detailProduct} />],
] as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-12-30T12:00:00.000Z'));
  server.getDiscountEnvironment.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('priceForCard', () => {
  it('межа акції — за env.now, не за годинником браузера', () => {
    // Браузер «живе» 2025-12-30, акція діє до 2025-12-31, сервер каже 2026-01-01.
    expect(priceForCard(1000, F.expiredEnv, ITEM)).toEqual({
      price: 1000,
      basePrice: 1000,
      hints: [
        { kind: 'quantity', threshold: 5, finalPrice: 800, percentOff: 20 },
      ],
    });
    // Позитивний контроль: та сама акція на серверний час до межі — діє.
    const before = { ...F.expiredEnv, now: new Date('2025-12-30T00:00:00Z') };
    expect(priceForCard(1000, before, ITEM).price).toBe(900);
  });

  it('min_quantity >= 3 −10%: ціна картки — база, знижка лише в підказці', () => {
    expect(priceForCard(1000, F.quantityEnv, ITEM)).toEqual({
      price: 1000,
      basePrice: 1000,
      hints: [
        { kind: 'quantity', threshold: 3, finalPrice: 900, percentOff: 10 },
      ],
    });
  });
});

describe.each(surfaces)('картка: %s', (_name, node) => {
  it('порогова підказка «від 3 шт — 900 ₴/шт (−10%)», ціна 1 000 ₴', async () => {
    server.getDiscountEnvironment.mockResolvedValue(F.quantityEnv);
    renderPage(node());
    await screen.findByText(/від 3 шт/);
    expect(text()).toContain('від 3 шт — 900 ₴/шт (−10%)');
    expect(text()).toContain('1 000 ₴');
    // Бейдж знижки картки (`-N%`) — лише коли знижка УВІЙШЛА в ціну.
    expect(text()).not.toContain('-10%');
  });

  it('акція, що закінчилась за серверним часом, на картці не діє', async () => {
    server.getDiscountEnvironment.mockResolvedValue(F.expiredEnv);
    renderPage(node());
    // Підказка доводить, що середовище вже застосоване, а не SSR-база.
    await screen.findByText(/від 5 шт/);
    expect(text()).toContain('від 5 шт — 800 ₴/шт (−20%)');
    expect(text()).toContain('1 000 ₴');
    expect(text()).not.toContain('900 ₴');
  });
});

describe('тип ціни з середовища (ред.2)', () => {
  it('покупця перевели в «опт» — повторний mount показує оптову базу', async () => {
    server.getDiscountEnvironment
      .mockResolvedValueOnce(F.retailEnv)
      .mockResolvedValue({ ...F.retailEnv, priceTypeId: F.WHOLESALE });
    // Один кеш на обидва mount-и — як у застосунку між переходами.
    const client = newClient();
    const page = <PropertyPage {...F.propertyPageData} />;
    const first = renderPage(page, client);
    await waitFor(() => expect(text()).toContain('1 000 ₴'));
    first.unmount();

    renderPage(page, client);
    await waitFor(() => expect(text()).toContain('800 ₴'));
    expect(text()).not.toContain('1 000 ₴');
  });
});
