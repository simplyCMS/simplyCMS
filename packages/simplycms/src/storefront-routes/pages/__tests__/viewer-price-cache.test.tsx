// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useDiscountEnvironment } from 'simplycms/core/hooks/useDiscountEnvironment';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiscountEnvironment } from 'simplycms/contracts';
import { I18nProvider } from 'simplycms/i18n';
import { AGGREGATE } from 'simplycms/contracts/entities';
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
/** Чи був РЕНДЕР, що вже бачив збій середовища, — детермінований сигнал. */
const envErrorRendered = vi.hoisted(() => vi.fn());
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
  if (useDiscountEnvironment().isError) envErrorRendered();
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
  envErrorRendered.mockClear();
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

  /** Кожен стан будь-якої гостьової комірки з гуртовою ціною — витік. */
  const watchGuestLeaks = () => {
    const leaked: string[] = [];
    const stop = client.getQueryCache().subscribe(({ query }) => {
      const data = JSON.stringify(query.state.data ?? null);
      if (
        query.queryKey[1] === 'guest' &&
        data.includes(`"price_type_id":"${F.WHOLESALE}"`)
      )
        leaked.push(JSON.stringify(query.queryKey));
    });
    return { leaked, stop };
  };

  it('M5: збій середовища без відомого виду — сентинел, гуртового в гостьовій комірці немає ні до, ні після виходу', async () => {
    session.userId = USER;
    envState.fail = true;
    auth.state = { user: { id: USER }, isLoading: false };
    loader.product = F.detailProduct; // SSR-лоадер рахував гуртового покупця
    const watch = watchGuestLeaks();
    const view = mount();
    // Запити не висять вічно: шість комірок із даними (сегмент не `null`).
    await waitFor(() =>
      expect(
        priced().filter(
          (q) => q.queryKey[1] !== null && q.state.data !== undefined,
        ),
      ).toHaveLength(6),
    );
    // До виходу: жодна гостьова комірка не тримає гуртового прайсу…
    expect(watch.leaked).toEqual([]);
    // …бо покупець із невідомим видом — під сентинелом (комірка `null` —
    // засів лоадером до розвʼязання виду, вона не ходить у мережу).
    for (const q of priced().filter(
      (q) => q.queryKey[1] !== null && q.state.data !== undefined,
    ))
      expect(q.queryKey[1]).toBe('unresolved');

    session.userId = null;
    envState.fail = false;
    auth.state = { user: null, isLoading: false };
    view.rerender(tree());
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hasWholesale()).toBe(false));
    watch.stop();
    expect(watch.leaked).toEqual([]);
  });

  it('M5: невдалий фоновий перезапит середовища не міняє відомий вид покупця', async () => {
    session.userId = USER;
    auth.state = { user: { id: USER }, isLoading: false };
    mount();
    await waitFor(() =>
      expect(
        priced().filter(
          (q) => q.queryKey[1] === F.WHOLESALE && q.state.data !== undefined,
        ),
      ).toHaveLength(6),
    );
    // Кожна НОВА комірка з цінами після збою — ознака зміни виду.
    const added: unknown[] = [];
    const stop = client.getQueryCache().subscribe((event) => {
      if (event.type === 'added' && isViewerPricedQuery(event.query))
        added.push(event.query.queryKey);
    });
    envState.fail = true;
    await act(() =>
      client.refetchQueries({ queryKey: AGGREGATE.discountEnvironment.key }),
    );
    // Сповіщення спостерігачів React Query відкладене (`notifyManager`), тож
    // чекаємо саме рендеру, який уже бачив збій, а не таймер.
    await waitFor(() => expect(envErrorRendered).toHaveBeenCalled());
    stop();
    expect(added).toEqual([]);
    // Жодної нової комірки під іншим сегментом — вид лишився гуртовим.
    const segments = new Set(
      priced()
        .filter((q) => q.getObserversCount() > 0)
        .map((q) => q.queryKey[1]),
    );
    expect([...segments]).toEqual([F.WHOLESALE]);
  });
});
