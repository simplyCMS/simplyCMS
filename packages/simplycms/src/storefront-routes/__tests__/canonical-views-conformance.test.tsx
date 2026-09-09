// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { assertThemeViewsConformance } from 'simplycms/themes/conformance';
import type { ThemeModule } from 'simplycms/themes/types';

/**
 * Канонічні view ядра прогнані ЧЕРЕЗ conformance-kit (Фаза 6, Step 3).
 *
 * 🔴 Тест живе на боці route-пакета, а не в `simplycms/themes`: kit (T4) не
 * має права залежати від `storefront-routes` (T5) — тіри залежностей
 * односторонні. Тому «канонічні view чисті» доводиться там, де ці view
 * лежать, тим самим інструментом, яким доводитиме себе стороння тема.
 *
 * Мокаються рівно ті модулі, які kit підняти не може й не мусить: навігація
 * (`Link` без роутера) і компоненти v2.2-контракту, що самі тягнуть
 * `embla-carousel-react` (під jsdom потребує ResizeObserver-полiфілу — той
 * самий прийом, що в `home-view.test.tsx`).
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));

vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../components/BannerSlider', () => ({
  BannerSlider: () => <div data-testid="banner-slider" />,
}));

import { CartView } from '../views/CartView';
import { CatalogSectionView } from '../views/CatalogSectionView';
import { CatalogView } from '../views/CatalogView';
import { HomeView } from '../views/HomeView';
import { ProductDetailView } from '../views/ProductDetailView';

function Stub() {
  return <div />;
}

const canonicalTheme: ThemeModule = {
  manifest: {
    name: 'canonical-views-probe',
    displayName: 'Canonical views probe',
    version: '1.0.0',
    engines: { simplycms: '>=0.0.0' },
  },
  tokens: {},
  components: { Header: Stub, Footer: Stub },
  views: {
    Home: HomeView,
    Catalog: CatalogView,
    CatalogSection: CatalogSectionView,
    ProductDetail: ProductDetailView,
    Cart: CartView,
  },
};

describe('канонічні view ядра — conformance-kit', () => {
  // 🔴 Асертиться саме ПЕРЕЛІК прогнаних сторінок, а не `undefined`: kit на
  // порожньому списку кейсів чесно проходить, тож без цієї звірки випалий
  // блок у `conformance/cases.tsx` лишив би тест зеленим.
  it('усі пʼять сторінок проходять гейт на фікстурах обох станів', async () => {
    await expect(assertThemeViewsConformance(canonicalTheme)).resolves.toEqual([
      'Home',
      'Catalog',
      'CatalogSection',
      'ProductDetail',
      'Cart',
    ]);
  });
});
