// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render } from '@testing-library/react';
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
import { I18nProvider, useUiCatalogs } from 'simplycms/i18n';
import { CartProvider } from 'simplycms/react-query';
import type { LocaleSet } from 'simplycms/contracts';
import type { RouterContext } from 'simplycms/runtime';
import type { HomeProduct } from '../pages/home/types';
import type { ProductDetailProduct } from '../pages/product-detail/types';
import { TestEngineProvider } from './engine-stub';
import { messages as baseUk } from '../../i18n/catalogs/uk/base';
import { messages as baseEn } from '../../i18n/catalogs/en/base';
import { messages as mailUk } from '../../i18n/catalogs/uk/mail';
import { messages as adminUk } from '../../i18n/catalogs/uk/admin';

/**
 * І44 (спека §19.5): у відрендереному HTML вітрини не буває сирого ключа каталогу —
 * ні в текстовому вузлі, ні в значенні атрибута. Сирий ключ — ознака каталогу, що не
 * встиг завантажитись до рендера (`t()` повертає ключ як є). Роутер, лоадер кореня й
 * `head()` справжні; з підміненого лише серверний вхід у БД.
 */
vi.mock('../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: {
      name: 'Крамниця',
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
// Карусель на embla не потрібна: тут важлива лише назва блока з каталогу.
vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock('../components/BannerSlider', () => ({ BannerSlider: () => null }));
vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));
// Клієнтський рендер перезапитує товар на монтуванні: мок віддає той самий рядок, що лоадер.
const fixtures = vi.hoisted(() => ({
  product: (_locale: string): unknown => null,
}));
vi.mock('../server/products', () => ({
  getProduct: async ({ data }: { data: { locale: string } }) =>
    fixtures.product(data.locale),
  getMovedProductPath: async () => null,
  getModificationData: async () => ({ propertyValues: {}, stock: {} }),
}));

import { htmlLangAttrs } from '../locale/lang-attrs';
import { createLocaleRewrite } from '../locale/rewrite';
import { loadStorefrontRoot } from '../locale/root-data';
import { localeSet } from '../../../test-harness/locale';
import HomePage from '../pages/Home';
import CartPage from '../pages/Cart';
import ProductDetailPage from '../pages/ProductDetail';
import { entityHead } from '../pages/entity-route';

// `pl` — опублікована, але пакета інтерфейсу немає: тексти беруться з основної мови.
const SET: LocaleSet = localeSet('uk', ['uk', 'en', 'pl']);

/** Текст сторінки з каталогу мови інтерфейсу (з самих каталогів, а не з голови). */
const PAGE_TEXT = {
  uk: {
    '/': baseUk['home.featured'],
    '/x': baseUk['product.addToCart'],
    '/cart': baseUk['cart.title'],
  },
  en: {
    '/': baseEn['home.featured'],
    '/x': baseEn['product.addToCart'],
    '/cart': baseEn['cart.title'],
  },
} as Record<string, Record<string, string>>;

const RAW_KEYS = new Set([
  ...Object.keys(baseUk),
  ...Object.keys(adminUk),
  ...Object.keys(mailUk),
]);

/** Мінімум товару, який віддає `loadProduct`: текст і SEO уже з проєкції. */
const product = (locale: string) =>
  ({
    id: 'p1',
    section_id: null,
    slug: 'x',
    name: 'Кабель',
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
        price_type_id: 'r',
        modification_id: null,
        price: 100,
        old_price: null,
      },
    ],
    product_property_values: [],
    guest_price_types: { priceTypeId: 'r', defaultPriceTypeId: 'r' },
    page: {
      locale,
      primary: 'uk',
      path: 'x',
      isTranslated: true,
      fallbackFields: [],
      seo: { robots: 'index, follow', canonical: '/x', hreflang: [] },
    },
  }) as unknown as ProductDetailProduct;

fixtures.product = product;

const FEATURED = {
  id: 'p1',
  name: 'Кабель',
  slug: 'x',
  images: [],
  short_description: null,
  stock_status: 'in_stock',
  section: null,
  section_id: null,
  price: 100,
  old_price: null,
  prices: [],
} satisfies HomeProduct;

function buildRouter(url: string) {
  const rewriteState = { current: SET.primary };
  const root = createRootRouteWithContext<RouterContext>()({
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
    context: { locales: SET } as RouterContext,
  });
}

/** Усі текстові вузли й значення атрибутів документа. */
function visibleStrings(root: Node): string[] {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE)
      out.push(node.nodeValue?.trim() ?? '');
    if (node instanceof Element)
      for (const attr of Array.from(node.attributes)) out.push(attr.value);
    node.childNodes.forEach(walk);
  };
  walk(root);
  return out.filter(Boolean);
}

const rawKeysIn = (strings: string[]) => strings.filter((s) => RAW_KEYS.has(s));

async function ssr(url: string): Promise<Document> {
  const router = buildRouter(url);
  await router.load();
  const html = renderToString(<RouterProvider router={router} />);
  return new DOMParser().parseFromString(html, 'text/html');
}

afterEach(cleanup);

describe('у HTML вітрини немає сирих ключів каталогу (І44)', () => {
  for (const lang of ['uk', 'en', 'pl']) {
    const prefix = lang === 'uk' ? '' : `/${lang}`;
    for (const path of ['/', '/x', '/cart']) {
      const url = `${prefix}${path === '/' && prefix ? '' : path}` || '/';
      it(`${url}: жоден текстовий вузол чи атрибут не дорівнює ключу`, async () => {
        const doc = await ssr(url);
        const strings = visibleStrings(doc);
        // Не вакуум: порожня оболонка (корінь призупинився на каталозі) теж не має ключів,
        // тож сторінка мусить показати свій перекладений текст мовою ІНТЕРФЕЙСУ (pl → uk).
        expect(doc.body.textContent).toContain(
          PAGE_TEXT[lang === 'en' ? 'en' : 'uk'][path],
        );
        expect(rawKeysIn(strings)).toEqual([]);
      });
    }
  }

  it('детектор бачить сирий ключ (негативний контроль самого помічника)', () => {
    const doc = new DOMParser().parseFromString(
      '<button title="common.save">common.save</button>',
      'text/html',
    );
    expect(rawKeysIn(visibleStrings(doc))).toEqual([
      'common.save',
      'common.save',
    ]);
  });

  it('/en/x — інтерфейс англійською, а /pl/x (без пакета pl) — основною мовою', async () => {
    expect((await ssr('/en/x')).body.textContent).toContain('Add to cart');
    expect((await ssr('/pl/x')).body.textContent).not.toContain('Add to cart');
  });

  it('клієнтський перехід /x → /en/x: після load() англійський рендер без сирих ключів', async () => {
    const router = buildRouter('/x');
    await router.load();
    const view = render(<RouterProvider router={router} />);
    expect(view.container.ownerDocument.body.textContent).not.toContain(
      'Add to cart',
    );

    await act(async () => {
      await router.navigate({ href: '/en/x' });
      await router.load();
    });

    const doc = view.container.ownerDocument;
    expect(doc.body.textContent).toContain('Add to cart');
    expect(rawKeysIn(visibleStrings(doc.body))).toEqual([]);
  });
});
