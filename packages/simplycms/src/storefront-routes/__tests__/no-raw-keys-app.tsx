import { vi } from 'vitest';
import { FEATURED, SET, product } from './no-raw-keys-fixtures';

/**
 * Застосунок вітрини для `no-raw-keys-html.test.tsx` на СВІЖОМУ графі модулів.
 *
 * Реєстр каталогів тримає кеш на весь процес, а `head()` товару сам прогріває `base`: на
 * спільному кеші кейс «каталог не встиг» червонів би лише для першої сторінки файла, тож
 * порядок кейсів вирішував би, чи тест кусається. `vi.resetModules()` + динамічні імпорти
 * дають кожному кейсові порожній реєстр (як `fresh()` у `registry.test.ts`); усе, чим
 * користується кейс (React, роутер, RTL), береться з ТОГО Ж свіжого графа.
 */
export async function loadApp() {
  vi.resetModules();
  const [
    { renderToString },
    { act, render },
    { QueryClient, QueryClientProvider },
    router,
    { I18nProvider, useUiCatalogs },
    { CartProvider },
    { TestEngineProvider },
    { htmlLangAttrs },
    { createLocaleRewrite },
    { loadStorefrontRoot },
    { default: HomePage },
    { default: CartPage },
    { default: ProductDetailPage },
    { entityHead },
  ] = await Promise.all([
    import('react-dom/server'),
    import('@testing-library/react'),
    import('@tanstack/react-query'),
    import('@tanstack/react-router'),
    import('simplycms/i18n'),
    import('simplycms/react-query'),
    import('./engine-stub'),
    import('../locale/lang-attrs'),
    import('../locale/rewrite'),
    import('../locale/root-data'),
    import('../pages/Home'),
    import('../pages/Cart'),
    import('../pages/ProductDetail'),
    import('../pages/entity-route'),
  ]);
  const {
    HeadContent,
    Outlet,
    RouterProvider,
    createMemoryHistory,
    createRootRouteWithContext,
    createRoute,
    createRouter,
  } = router;

  function buildRouter(url: string) {
    const rewriteState = { current: SET.primary };
    const root = createRootRouteWithContext<{ locales: typeof SET }>()({
      loader: ({ location, context }) =>
        loadStorefrontRoot(location.publicHref, context.locales),
      head: () => ({ meta: [{ charSet: 'utf-8' }] }),
      component: function Root() {
        const data = root.useLoaderData();
        const catalogs = useUiCatalogs(data.ui.locale, ['base']);
        const client = new QueryClient({
          defaultOptions: { queries: { retry: false } },
        });
        return (
          <html {...htmlLangAttrs(data.locale)}>
            <head>
              <HeadContent />
            </head>
            <body>
              <I18nProvider
                locale={data.ui.locale}
                fallback={data.ui.fallback}
                catalogs={catalogs}
              >
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
    const home = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => <HomePage featuredProducts={[FEATURED]} />,
    });
    const cart = createRoute({
      getParentRoute: () => root,
      path: '/cart',
      component: CartPage,
    });
    const item = createRoute({
      getParentRoute: () => root,
      path: '/x',
      loader: ({ location }) => ({
        product: product(location.publicHref.startsWith('/en') ? 'en' : 'uk'),
      }),
      head: ({ loaderData, matches }) =>
        entityHead(matches, loaderData as Parameters<typeof entityHead>[1]),
      component: function Item() {
        const { product: p } = item.useLoaderData();
        return <ProductDetailPage product={p} path="x" />;
      },
    });
    return createRouter({
      routeTree: root.addChildren([home, cart, item]),
      history: createMemoryHistory({ initialEntries: [url] }),
      rewrite: createLocaleRewrite(SET, rewriteState),
      context: { locales: SET },
    });
  }

  /** SSR сторінки за публічною адресою: роутер → лоадери → `renderToString` → документ. */
  async function ssr(url: string): Promise<Document> {
    const r = buildRouter(url);
    await r.load();
    const html = renderToString(<RouterProvider router={r} />);
    return new DOMParser().parseFromString(html, 'text/html');
  }

  return { buildRouter, ssr, RouterProvider, act, renderIntoDom: render };
}
