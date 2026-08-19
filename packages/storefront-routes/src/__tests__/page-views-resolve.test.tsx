import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@simplycms/i18n';
import { CartProvider } from '@simplycms/react-query';
import type { ThemeModule } from '@simplycms/themes/types';
import { TestEngineProvider } from './engine-stub';

/**
 * Резолв `theme.views` на КОЖНІЙ із пʼяти канонічних сторінок вітрини
 * (контракт тем v3).
 *
 * 🔴 Юніт `storefront-views-resolve.test.tsx` доводить ПРАВИЛО вибору, а не
 * те, що воно ввімкнене в контейнерах: підміна `useStorefrontViews(...)` на
 * простий літерал одразу в усіх пʼятьох сторінках лишала суїт зеленим. Тут
 * під тестом саме проводка — контейнери справжні.
 *
 * 🔴 Канонічні view замокано маркерними стабами навмисно: перевіряється
 * ВИБІР гілки, а не розмітка (її доводять `*-view.test.tsx` і
 * `canonical-views-conformance.test.tsx`). Побічна вигода — тест не тягне
 * провайдерів, яких вимагають справжні view.
 */
const themeModule = vi.hoisted(() => ({ current: {} as ThemeModule }));

vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => themeModule.current,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ sectionSlug: 'panels', productSlug: 'panel-550' }),
  useNavigate: () => () => {},
  useLocation: ({ select }: { select: (l: { pathname: string }) => unknown }) =>
    select({ pathname: '/catalog/panels/panel-550' }),
  useSearch: () => ({}),
}));

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({}) }) }),
  }),
}));

vi.mock('@simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../views/HomeView', () => ({
  HomeView: () => <div data-testid="canonical-view" />,
}));
vi.mock('../views/CatalogView', () => ({
  CatalogView: () => <div data-testid="canonical-view" />,
}));
vi.mock('../views/CatalogSectionView', () => ({
  CatalogSectionView: () => <div data-testid="canonical-view" />,
}));
vi.mock('../views/ProductDetailView', () => ({
  ProductDetailView: () => <div data-testid="canonical-view" />,
}));
vi.mock('../views/CartView', () => ({
  CartView: () => <div data-testid="canonical-view" />,
}));

import Cart from '../pages/Cart';
import CatalogPage from '../pages/Catalog';
import CatalogSectionPage, {
  type CatalogSectionPageProps,
} from '../pages/CatalogSection';
import HomePage from '../pages/Home';
import ProductDetailPage, {
  type ProductDetailPageProps,
} from '../pages/ProductDetail';

function ThemeViewStub() {
  return <div data-testid="theme-view" />;
}

const section = {
  id: 'sec-1',
  name: 'Панелі',
  slug: 'panels',
  description: null,
} as unknown as NonNullable<CatalogSectionPageProps['initialSection']>;

/** Мінімальний товар: контейнер віддає view лише за наявності товару й ціни. */
const product = {
  id: 'prod-1',
  slug: 'panel-550',
  name: 'Панель 550 Вт',
  images: [],
  has_modifications: false,
  stock_status: 'in_stock',
  sku: 'P-550',
  short_description: null,
  description: null,
  sections: section,
  product_prices: [{ price_type_id: null, price: 4200, old_price: null }],
} as unknown as NonNullable<ProductDetailPageProps['product']>;

/** Провайдери — рівно ті, що тримає прод (`__root.tsx`). */
function ssr(node: ReactNode): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToString(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <CartProvider>{node}</CartProvider>
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const pages = [
  { name: 'Home', node: <HomePage /> },
  { name: 'Catalog', node: <CatalogPage /> },
  {
    name: 'CatalogSection',
    node: <CatalogSectionPage initialSection={section} />,
  },
  { name: 'ProductDetail', node: <ProductDetailPage product={product} /> },
  { name: 'Cart', node: <Cart /> },
] as const;

describe.each(pages)('сторінка $name: резолв view', ({ name, node }) => {
  it('тема заявила view — рендериться ТЕМОВИЙ', () => {
    themeModule.current = {
      views: { [name]: ThemeViewStub },
    } as unknown as ThemeModule;

    const html = ssr(node);

    expect(html).toContain('theme-view');
    expect(html).not.toContain('canonical-view');
  });

  it('тема без views — рендериться канонічний view ядра', () => {
    themeModule.current = { components: {} } as unknown as ThemeModule;

    const html = ssr(node);

    expect(html).toContain('canonical-view');
    expect(html).not.toContain('theme-view');
  });
});
