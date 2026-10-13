// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiscountEnvironment } from 'simplycms/contracts';
import { I18nProvider } from 'simplycms/i18n';
import { isViewerPricedQuery } from 'simplycms/react-query';
import { TestEngineProvider } from '../../__tests__/engine-stub';
import * as F from './support/card-fixtures';

/**
 * Р29 на клієнті: ключ публічних запитів з цінами несе ВИД цін глядача
 * (`'guest'` / id виду), а не `userId`; вхід і вихід скидають прайс
 * попереднього глядача — після виходу гуртових цін у кеші немає.
 */
const USER = 'u-wholesale';
const GUEST_ONLY = F.detailProduct.product_prices.filter(
  (p) => p.price_type_id === F.RETAIL,
);
const wholesaleEnv: DiscountEnvironment = {
  ...F.retailEnv,
  actor: { userId: USER, categoryId: 'cat-opt', isLoggedIn: true },
  priceTypeId: F.WHOLESALE,
};

/** «Сесія» сервера: що віддає serverFn, вирішує cookie, а не аргумент. */
const session = vi.hoisted(() => ({ userId: null as string | null }));
const auth = vi.hoisted(() => ({
  state: { user: null as { id: string } | null, isLoading: false },
}));
const router = vi.hoisted(() => ({ invalidate: vi.fn() }));
/** Дані лоадера роуту картки — `initialData`; `router.invalidate` їх перераховує. */
const loader = vi.hoisted(() => ({ product: undefined as unknown }));
const envState = vi.hoisted(() => ({ fail: false }));
const withPrices = <T extends { product_prices: unknown }>(row: T): T =>
  session.userId ? row : { ...row, product_prices: GUEST_ONLY };

vi.mock('simplycms/core/lib/discounts', () => ({
  getDiscountEnvironment: async () => {
    if (envState.fail) throw new Error('env down');
    return session.userId ? wholesaleEnv : F.retailEnv;
  },
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => auth.state,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ propertySlug: 'color', optionSlug: 'black' }),
  useRouter: () => router,
}));
vi.mock('../../server/products', () => ({
  getProduct: async () => withPrices(F.detailProduct),
}));
vi.mock('../../server/catalog', () => ({
  getCatalogProducts: async () => [withPrices(F.catalogRow)],
}));
vi.mock('../../server/home', () => ({
  getFeaturedProducts: async () => [
    { ...F.homeRow, prices: withPrices(F.catalogRow).product_prices },
  ],
  getNewProducts: async () => [],
  getRootSections: async () => [],
  getSectionProducts: async () => [],
}));
vi.mock('../../server/properties', () => ({
  getPropertyOption: async () => ({
    ...F.propertyPageData,
    products: [withPrices(F.catalogRow)],
  }),
}));

import {
  useViewerPriceSync,
  ViewerLoaderFreshContext,
} from 'simplycms/core/hooks/useViewerPriceSync';
import type { ProductDetailProduct } from '../product-detail/types';
import { useProductQuery } from '../product-detail/useProductQuery';
import { useCatalogProductsQuery } from '../catalog/useCatalogProductsQuery';
import {
  useFeaturedProducts,
  useNewProducts,
  useSectionProducts,
} from '../home/queries';
import PropertyPage from '../PropertyPage';

const SECTION = { id: 's1', name: 'Панелі', slug: 'panels' };

function Surfaces() {
  // Як `AuthProvider`: синк сесії + свіжість даних лоадерів для засіву.
  const fresh = useViewerPriceSync(
    auth.state.user?.id ?? null,
    auth.state.isLoading,
  );
  return (
    <ViewerLoaderFreshContext.Provider value={fresh}>
      <Queries />
    </ViewerLoaderFreshContext.Provider>
  );
}

function Queries() {
  useProductQuery('panel', loader.product as ProductDetailProduct | undefined);
  useCatalogProductsQuery(undefined);
  useFeaturedProducts();
  useNewProducts();
  useSectionProducts(SECTION);
  return <PropertyPage />;
}

let client: QueryClient;
const tree = () => (
  <QueryClientProvider client={client}>
    <I18nProvider locale="uk">
      <TestEngineProvider>
        <Surfaces />
      </TestEngineProvider>
    </I18nProvider>
  </QueryClientProvider>
);
const mount = () => render(tree());
const priced = () =>
  client.getQueryCache().findAll({ predicate: isViewerPricedQuery });
const hasWholesale = () =>
  priced().some((q) =>
    JSON.stringify(q.state.data ?? null).includes(
      `"price_type_id":"${F.WHOLESALE}"`,
    ),
  );

beforeEach(() => {
  // Як у `src/router.tsx`: 5 хв свіжості — без скидання стара комірка жила б.
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  session.userId = null;
  auth.state = { user: null, isLoading: false };
  envState.fail = false;
  loader.product = undefined;
  router.invalidate.mockReset();
  // Перезапуск лоадерів: дані роуту рахуються вже для нової сесії.
  router.invalidate.mockImplementation(async () => {
    loader.product = withPrices(F.detailProduct);
  });
});
afterEach(cleanup);

describe('ключ і скидання прайсу глядача (Р29)', () => {
  it('гість: сегмент 1 ключа — "guest" у всіх шести запитах з цінами', async () => {
    mount();
    await waitFor(() => expect(priced()).toHaveLength(6));
    for (const q of priced()) expect(q.queryKey[1]).toBe('guest');
  });

  it('покупець: сегмент 1 — id його виду цін, userId у ключі немає', async () => {
    session.userId = USER;
    auth.state = { user: { id: USER }, isLoading: false };
    mount();
    await waitFor(() =>
      expect(
        priced().filter((q) => q.queryKey[1] === F.WHOLESALE),
      ).toHaveLength(6),
    );
    for (const q of priced())
      expect(JSON.stringify(q.queryKey)).not.toContain(USER);
  });

  it('поки сесія розвʼязується — запити з цінами не ходять', async () => {
    auth.state = { user: null, isLoading: true };
    mount();
    await new Promise((r) => setTimeout(r, 20));
    for (const q of priced()) expect(q.state.data).toBeUndefined();
    expect(router.invalidate).not.toHaveBeenCalled();
  });

  it('вихід: прайс перезапитано, гуртових цін у кеші немає', async () => {
    session.userId = USER;
    auth.state = { user: { id: USER }, isLoading: false };
    const view = mount();
    await waitFor(() => expect(hasWholesale()).toBe(true));
    // Перше розвʼязання сесії — не вхід: скидати нічого.
    expect(router.invalidate).not.toHaveBeenCalled();

    session.userId = null;
    auth.state = { user: null, isLoading: false };
    view.rerender(tree());
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(priced().length).toBeGreaterThan(0);
      expect(hasWholesale()).toBe(false);
    });
  });

  it('вхід: лоадери перезапущено, покупець дістає свій вид', async () => {
    const view = mount();
    await waitFor(() => expect(priced()).toHaveLength(6));
    expect(hasWholesale()).toBe(false);

    session.userId = USER;
    auth.state = { user: { id: USER }, isLoading: false };
    view.rerender(tree());
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hasWholesale()).toBe(true));
    // Гостьові комірки скинуто разом із рештою — лишились лише комірки виду покупця.
    await waitFor(() =>
      expect(priced().every((q) => q.queryKey[1] === F.WHOLESALE)).toBe(true),
    );
  });

  it('M4: вихід з гуртовим initialData лоадера — гостьова комірка жодного разу не має гуртової ціни', async () => {
    session.userId = USER;
    auth.state = { user: { id: USER }, isLoading: false };
    loader.product = F.detailProduct; // SSR-лоадер рахував гуртового покупця
    const view = mount();
    await waitFor(() => expect(hasWholesale()).toBe(true));

    const leaked: unknown[] = [];
    const unsubscribe = client.getQueryCache().subscribe(({ query }) => {
      if (query.queryKey[1] === 'guest' && query.queryKey[2] === 'detail') {
        const data = JSON.stringify(query.state.data ?? null);
        if (data.includes(`"price_type_id":"${F.WHOLESALE}"`))
          leaked.push(data);
      }
    });
    session.userId = null;
    auth.state = { user: null, isLoading: false };
    view.rerender(tree());
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hasWholesale()).toBe(false));
    unsubscribe();
    expect(leaked).toEqual([]);
  });

  it('M5: збій середовища цін у покупця — гостьовий сегмент, запити вантажаться', async () => {
    session.userId = USER;
    envState.fail = true;
    auth.state = { user: { id: USER }, isLoading: false };
    mount();
    // Поки середовище в дорозі — `null` (комірки без даних); після збою —
    // усі шість запитів під 'guest' і з даними, а не вічне очікування.
    await waitFor(() =>
      expect(
        priced().filter(
          (q) => q.queryKey[1] === 'guest' && q.state.data !== undefined,
        ),
      ).toHaveLength(6),
    );
  });
});
