// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { TestEngineProvider } from '../../__tests__/engine-stub';
import * as F from './support/card-fixtures';

/**
 * Фінальне рев'ю К3-Е6в, F1: збій середовища цін (`getDiscountEnvironment`)
 * на кожній поверхні-картці — видимий стан помилки з «Повторити», як
 * `QuoteFailure` кошика, а НЕ мовчазна база за дефолтним типом (вона
 * розвела б картку й чек) і не вічна SSR-сітка з мертвими фільтрами.
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

import HomePage from '../Home';
import PropertyPage from '../PropertyPage';
import { CatalogCards } from './support/CatalogCards';
import { ProductPrice } from './support/ProductPrice';

/** SSR-рядок каталогу: до фіксу сітка назавжди лишалась на ньому. */
const SSR_ITEM = {
  id: F.PRODUCT_ID,
  slug: 'panel',
  name: 'Панель SSR',
  imageUrl: null,
  price: 1000,
  sectionSlug: 'panels',
};

const surfaces = [
  [
    'каталог',
    () => <CatalogCards rows={[F.catalogRow]} ssrItems={[SSR_ITEM]} />,
  ],
  ['головна', () => <HomePage featuredProducts={[F.homeRow]} />],
  ['PropertyPage', () => <PropertyPage {...F.propertyPageData} />],
  ['сторінка товару', () => <ProductPrice product={F.detailProduct} />],
] as const;

const text = () => document.body.textContent?.replace(/ /g, ' ') ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-12-30T12:00:00.000Z'));
  server.getDiscountEnvironment.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(surfaces)('збій середовища цін: %s', (_name, node) => {
  it('видно помилку з «Повторити» без ціни; повтор показує ціни', async () => {
    server.getDiscountEnvironment
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue(F.quantityEnv);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider locale="uk">
          <TestEngineProvider>{node()}</TestEngineProvider>
        </I18nProvider>
      </QueryClientProvider>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Ціни не вдалося завантажити');
    // Жодної «бази» поруч із помилкою: число розійшлося б із чеком.
    expect(text()).not.toContain('1 000 ₴');
    expect(text()).not.toContain('Панель SSR');

    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }));
    await screen.findByText(/від 3 шт/);
    expect(text()).toContain('1 000 ₴');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(server.getDiscountEnvironment).toHaveBeenCalledTimes(2);
  });
});
