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
 * Review Focus 5 (майстер §7) на ВІДРЕНДЕРЕНОМУ HTML сторінки товару: справжній
 * роутер (лоадер, `head()`, `rewrite` мови), справжній контейнер сторінки; з
 * підміненого лише серверний вхід у БД (`getProduct`), бо рендер тут без Postgres.
 * Те, що показує пошуковик і читач, доводиться розміткою, а не станом функцій.
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
vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));

const products = vi.hoisted(() => ({
  byAddress: new Map<string, unknown>(),
}));
vi.mock('../server/products', () => ({
  getProduct: async ({ data }: { data: { locale: string; path: string } }) =>
    products.byAddress.get(`${data.locale}/${data.path}`) ?? null,
  getMovedProductPath: async () => null,
  getModificationData: async () => ({ propertyValues: {}, stock: {} }),
}));

import { htmlLangAttrs } from '../locale/lang-attrs';
import { createLocaleRewrite } from '../locale/rewrite';
import { loadStorefrontRoot } from '../locale/root-data';
import type { LocaleSet } from '../locale/resolve';
import ProductDetailPage from '../pages/ProductDetail';
import {
  entityHead,
  entitySearch,
  loadEntityPage,
} from '../pages/entity-route';

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en'],
};

/** Рядок товару так, як його віддає `loadProduct`: текст і SEO вже з проєкції. */
function row(over: {
  path: string;
  locale: string;
  name: string;
  description: string | null;
  meta_title?: string | null;
  fallback: boolean;
  seo: {
    robots: string;
    canonical: string;
    hreflang: Array<{ hrefLang: string; href: string }>;
  };
  isTranslated: boolean;
  modifications?: unknown[];
  values?: unknown[];
}): ProductDetailProduct {
  return {
    id: 'prod-1',
    section_id: null,
    slug: over.path,
    name: over.name,
    short_description: null,
    description: over.description,
    meta_title: over.meta_title ?? null,
    meta_description: null,
    is_active: true,
    is_featured: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    images: [],
    has_modifications: (over.modifications?.length ?? 0) > 0,
    sku: null,
    stock_status: 'in_stock',
    sections: null,
    product_modifications: over.modifications ?? [],
    product_prices: [
      {
        price_type_id: 'retail',
        modification_id: null,
        price: 100,
        old_price: null,
      },
    ],
    product_property_values: over.values ?? [],
    guest_price_types: { priceTypeId: 'retail', defaultPriceTypeId: 'retail' },
    page: {
      locale: over.locale,
      primary: 'uk',
      path: over.path,
      isTranslated: over.isTranslated,
      fallbackFields: over.fallback ? ['name', 'description'] : [],
      seo: over.seo,
    },
  } as unknown as ProductDetailProduct;
}

// `/en/x` — неперекладене: текст основної мови (fallback), noindex, canonical на `/x`.
products.byAddress.set(
  'en/x',
  row({
    path: 'x',
    locale: 'en',
    name: 'Кабель',
    description: '<p>Опис <b>кабелю</b></p>',
    fallback: true,
    isTranslated: false,
    seo: { robots: 'noindex, follow', canonical: '/x', hreflang: [] },
  }),
);
// `/x` — основна.
products.byAddress.set(
  'uk/x',
  row({
    path: 'x',
    locale: 'uk',
    name: 'Кабель',
    description: '<p>Опис <b>кабелю</b></p>',
    fallback: false,
    isTranslated: true,
    seo: { robots: 'index, follow', canonical: '/x', hreflang: [] },
  }),
);
// `/en/t-en` — переклад: self-canonical і взаємний hreflang із x-default.
const TRANSLATED_HREFLANG = [
  { hrefLang: 'uk', href: '/t' },
  { hrefLang: 'en', href: '/en/t-en' },
  { hrefLang: 'x-default', href: '/t' },
];
products.byAddress.set(
  'en/t-en',
  row({
    path: 't-en',
    locale: 'en',
    name: 'Cable',
    description: '<p>Description</p>',
    meta_title: 'Cable SEO title',
    fallback: false,
    isTranslated: true,
    seo: {
      robots: 'index, follow',
      canonical: '/en/t-en',
      hreflang: TRANSLATED_HREFLANG,
    },
  }),
);
products.byAddress.set(
  'uk/t',
  row({
    path: 't',
    locale: 'uk',
    name: 'Кабель',
    description: null,
    fallback: false,
    isTranslated: true,
    seo: {
      robots: 'index, follow',
      canonical: '/t',
      hreflang: TRANSLATED_HREFLANG,
    },
  }),
);
// Модифікації й характеристики: ознака fallback іде з даних (`name_lang`/`value_lang`),
// а не з порівняння текстів — «XL» з перекладом, рівним основній, `lang` не має.
const mod = (id: string, name: string, lang: string | null) => ({
  id,
  name,
  name_lang: lang,
  slug: id,
  is_default: id === 'm1',
  sort_order: 0,
  stock_status: 'in_stock',
  sku: null,
  images: [],
});
products.byAddress.set(
  'en/mods',
  row({
    path: 'mods',
    locale: 'en',
    name: 'Cable',
    description: null,
    fallback: false,
    isTranslated: true,
    seo: { robots: 'index, follow', canonical: '/en/mods', hreflang: [] },
    modifications: [mod('m1', 'Чорний', 'uk'), mod('m2', 'XL', null)],
    values: [
      {
        property_id: 'p1',
        value: 'Лише укр',
        value_lang: 'uk',
        numeric_value: null,
        option_id: null,
        property_options: null,
        section_properties: {
          id: 'p1',
          name: 'Матеріал',
          slug: 'material',
          property_type: 'text',
          has_page: false,
        },
      },
      {
        property_id: 'p2',
        value: 'Steel',
        value_lang: null,
        numeric_value: null,
        option_id: null,
        property_options: null,
        section_properties: {
          id: 'p2',
          name: 'Frame',
          slug: 'frame',
          property_type: 'text',
          has_page: false,
        },
      },
    ],
  }),
);
// Опис із розміткою — без тегів у meta.
products.byAddress.set(
  'uk/html',
  row({
    path: 'html',
    locale: 'uk',
    name: 'Кабель',
    description: '<p>Опис <b>x</b></p>',
    fallback: false,
    isTranslated: true,
    seo: { robots: 'index, follow', canonical: '/html', hreflang: [] },
  }),
);

/** SSR сторінки за публічною адресою: роутер → лоадери → `renderToString`. */
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
            <I18nProvider
              locale={data.locale}
              fallback={data.languages.primary}
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

describe('сторінка товару: відрендерений HTML (Review Focus 5)', () => {
  it('/en/x неперекладеного: noindex, canonical на /x, текст uk у lang="uk", інтерфейс en', async () => {
    const html = await ssr('/en/x');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<meta name="robots" content="noindex, follow"');
    expect(html).toContain('<link rel="canonical" href="https://shop.test/x"');
    expect(html).not.toContain('hrefLang');
    expect(html).not.toContain('hreflang');
    // Текст основною мовою — всередині власного lang; опис — блоком.
    expect(html).toMatch(/<span lang="uk">Кабель<\/span>/);
    expect(html).toMatch(/<div lang="uk">[\s\S]*Опис <b>кабелю<\/b>/);
    // Кнопки й заголовки інтерфейсу — англійською.
    expect(html).toContain('>Description<');
    expect(html).toContain('>Specifications<');
    expect(html).toContain('Add to cart');
    expect(html).not.toContain('>Опис<');
  });

  it('назва модифікації і текст значення з основної мови мають lang; переклад, рівний джерелу, — ні (М3, І37)', async () => {
    const html = await ssr('/en/mods');
    expect(html).toContain('<span lang="uk">Чорний</span>');
    expect(html).not.toContain('<span lang="uk">XL</span>');
    expect(html).toContain('<span lang="uk">Лише укр</span>');
    expect(html).not.toContain('<span lang="uk">Steel</span>');
  });

  it('/x основної мови: self-canonical, без lang-обгорток fallback', async () => {
    const html = await ssr('/x');
    expect(html).toContain('<html lang="uk"');
    expect(html).toContain('<link rel="canonical" href="https://shop.test/x"');
    expect(html).not.toContain('<span lang=');
    expect(html).not.toContain('<div lang=');
  });

  it('перекладеного: self-canonical і hreflang uk, en, x-default', async () => {
    const html = await ssr('/en/t-en');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(
      '<link rel="canonical" href="https://shop.test/en/t-en"',
    );
    for (const [lang, href] of [
      ['uk', 'https://shop.test/t'],
      ['en', 'https://shop.test/en/t-en'],
      ['x-default', 'https://shop.test/t'],
    ] as const) {
      expect(html).toMatch(
        new RegExp(
          `<link rel="alternate" hrefLang="${lang}" href="${href}"|<link rel="alternate" href="${href}" hrefLang="${lang}"`,
          'i',
        ),
      );
    }
    expect(html).toContain('<meta name="robots" content="index, follow"');
    expect(html).toContain('<meta property="og:locale" content="en"');
  });

  it('meta_title використано в <title>', async () => {
    const html = await ssr('/en/t-en');
    expect(html).toMatch(/<title>Cable SEO title — Крамниця<\/title>/);
  });

  it('опис із HTML у meta description і og:description — без тегів', async () => {
    const html = await ssr('/html');
    expect(html).toContain('<meta name="description" content="Опис x"');
    expect(html).toContain('<meta property="og:description" content="Опис x"');
    expect(html).not.toMatch(/<meta[^>]*content="[^"]*<p>/);
  });
});
