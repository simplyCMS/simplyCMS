// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  HeadContent,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { I18nProvider } from 'simplycms/i18n';
import { CartProvider } from 'simplycms/react-query';
import type { RouterContext } from 'simplycms/runtime';
import type { ProductDetailProduct } from '../pages/product-detail/types';
import { TestEngineProvider } from './engine-stub';

/**
 * І41 на відрендереному HTML: мова КОНТЕНТУ (`pl`) і мова ІНТЕРФЕЙСУ (пакета `pl` немає →
 * основна `uk`) — дві різні осі. Дані товару запитуються мовою `pl`, а кнопки й заголовки
 * малюються каталогом `uk`; `<html lang>` лишається за мовою контенту. Справжній роутер,
 * справжній лоадер кореня й справжній міст; підміняється лише серверний вхід у БД.
 */
vi.mock('../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: {
      name: 'Sklep',
      homeTitle: null,
      description: null,
      contacts: { phone: null, email: null, address: null, hours: null },
      logoUrl: null,
      socials: [],
    },
    siteUrl: 'https://shop.test',
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));
vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));

const requested = vi.hoisted(() => ({ locales: [] as string[] }));
vi.mock('../server/products', () => ({
  getProduct: async ({ data }: { data: { locale: string; path: string } }) => {
    requested.locales.push(data.locale);
    return data.locale === 'pl' ? PL_PRODUCT : null;
  },
  getMovedProductPath: async () => null,
  getModificationData: async () => ({ propertyValues: {}, stock: {} }),
}));

import { htmlLangAttrs } from '../locale/lang-attrs';
import { createLocaleRewrite } from '../locale/rewrite';
import { loadStorefrontRoot } from '../locale/root-data';
import type { LocaleSet } from 'simplycms/contracts';
import { localeSet } from '../../../test-harness/locale';
import { ukT } from '../../../test-harness/i18n';
import ProductDetailPage from '../pages/ProductDetail';
import {
  entityHead,
  entitySearch,
  loadEntityPage,
} from '../pages/entity-route';

const SET: LocaleSet = localeSet('uk', ['uk', 'en', 'pl'], ['uk', 'en', 'pl']);

const PL_PRODUCT = {
  id: 'prod-1',
  section_id: null,
  slug: 'kabel',
  name: 'Kabel testowy',
  short_description: null,
  description: null,
  meta_title: null,
  meta_description: null,
  is_active: true,
  is_featured: false,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  images: [],
  has_modifications: false,
  sku: null,
  stock_status: 'in_stock',
  sections: null,
  product_modifications: [],
  product_prices: [
    {
      price_type_id: 'retail',
      modification_id: null,
      price: 100,
      old_price: null,
    },
  ],
  product_property_values: [],
  guest_price_types: { priceTypeId: 'retail', defaultPriceTypeId: 'retail' },
  page: {
    locale: 'pl',
    primary: 'uk',
    path: 'kabel',
    isTranslated: true,
    fallbackFields: [],
    seo: { robots: 'index, follow', canonical: '/pl/kabel', hreflang: [] },
  },
} as unknown as ProductDetailProduct;

/** SSR сторінки за публічною адресою — той самий каркас, що й у `__root.tsx` host-а. */
async function ssr(url: string): Promise<string> {
  const rewriteState = { current: SET.primary };
  const root = createRootRouteWithContext<RouterContext>()({
    loader: ({ location, context }) =>
      loadStorefrontRoot(location.publicHref, context.locales),
    head: () => ({ meta: [{ charSet: 'utf-8' }] }),
    component: function Root() {
      const data = root.useLoaderData();
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return (
        <html {...htmlLangAttrs(data.locale)}>
          <head>
            <HeadContent />
          </head>
          <body>
            <I18nProvider locale={data.ui.locale} fallback={data.ui.fallback}>
              <QueryClientProvider client={client}>
                <TestEngineProvider>
                  <CartProvider>
                    <Outlet />
                  </CartProvider>
                </TestEngineProvider>
              </QueryClientProvider>
            </I18nProvider>
          </body>
        </html>
      );
    },
  });
  const entity = createRoute({
    getParentRoute: () => root,
    path: '/$path',
    validateSearch: entitySearch,
    loader: ({ params, location, context }) =>
      loadEntityPage({
        path: params.path,
        publicHref: location.publicHref,
        locales: context.locales,
      }),
    head: ({ loaderData, matches }) => entityHead(matches, loaderData),
    component: function Entity() {
      const { product } = entity.useLoaderData() as Awaited<
        ReturnType<typeof loadEntityPage>
      >;
      return <ProductDetailPage product={product} path={product.page.path} />;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([entity]),
    history: createMemoryHistory({ initialEntries: [url] }),
    rewrite: createLocaleRewrite(SET, rewriteState),
    context: { locales: SET } as RouterContext,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe('мова контенту ≠ мова інтерфейсу (І41)', () => {
  it('/pl/kabel: дані запитано мовою pl, інтерфейс — каталогом uk, <html lang="pl">', async () => {
    const html = await ssr('/pl/kabel');
    expect(requested.locales).toContain('pl');
    expect(requested.locales).not.toContain('uk');
    expect(html).toContain('Kabel testowy');
    // Рядок інтерфейсу — з каталогу uk (основна мова), а не pl: пакета pl немає.
    expect(html).toContain(ukT('product.addToCart'));
    expect(html).toContain('<html lang="pl"');
  });
});
