// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HomeProduct, HomeSection } from '../pages/home/types';

/**
 * Task 0.2: секційні каруселі головної не роблять власних клієнтських
 * запитів — товари приходять із SSR-лоадера.
 *
 * 🔴 Гард стоїть на МІСЦІ ІНТЕГРАЦІЇ: рендериться компонент роуту
 * `/_storefront/` з даними лоадера, тож ланцюг «лоадер → props роуту →
 * `HomePage` → `initialData` каруселі» перевіряється цілком. Перевірка самої
 * лише каруселі пропускала б розрив у будь-якій із цих ланок.
 */

/** Значення `section_id` кожного клієнтського запиту товарів */
const sectionIdCalls: string[] = [];

function createSupabaseSpy() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.is = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.eq = (column: string, value: unknown) => {
    if (column === 'section_id') sectionIdCalls.push(String(value));
    return builder;
  };
  builder.then = <TResult,>(
    onfulfilled: (value: { data: unknown[]; error: null }) => TResult,
  ) => Promise.resolve({ data: [], error: null }).then(onfulfilled);
  return { from: () => builder };
}

const mockSupabase = createSupabaseSpy();

/** Дані, які «віддає» лоадер роуту в поточному тесті */
let loaderData: HomeLoaderData;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => loaderData,
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock('@simplycms/storefront-routes/server/home', () => ({
  getHomePageData: async () => loaderData,
}));

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => mockSupabase,
}));

vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));

vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../components/BannerSlider', () => ({
  BannerSlider: () => null,
}));

import { Route } from '../../routes/_storefront/index';

/** Форма повернення `loadHomePageData` — рівно те, що бачить компонент роуту. */
interface HomeLoaderData {
  banners: never[];
  featuredProducts: HomeProduct[];
  newProducts: HomeProduct[];
  sections: HomeSection[];
  sectionProducts?: Record<string, HomeProduct[]>;
}

const SECTIONS: HomeSection[] = [
  { id: 's1', name: 'Секція A', slug: 'a' },
  { id: 's2', name: 'Секція B', slug: 'b' },
  { id: 's3', name: 'Секція C', slug: 'c' },
];

const product = (id: string, sectionSlug: string): HomeProduct => ({
  id,
  name: `Товар ${id}`,
  slug: id,
  images: ['/img.jpg'],
  short_description: null,
  stock_status: 'in_stock',
  section: { slug: sectionSlug },
});

const SECTION_PRODUCTS: Record<string, HomeProduct[]> = {
  s1: [product('p1', 'a')],
  s2: [product('p2', 'b')],
  s3: [product('p3', 'c')],
};

const RouteComponent = Route.options.component as unknown as () => ReactNode;

function renderRoute(withSectionProducts: boolean) {
  loaderData = {
    banners: [],
    featuredProducts: [],
    newProducts: [],
    sections: SECTIONS,
    sectionProducts: withSectionProducts ? SECTION_PRODUCTS : undefined,
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouteComponent />
    </QueryClientProvider>,
  );
}

describe('роут головної: секційні товари приходять із SSR-лоадера', () => {
  beforeEach(() => {
    sectionIdCalls.length = 0;
  });

  it('дані лоадера дійшли до каруселей → 0 клієнтських запитів', async () => {
    const { container } = renderRoute(true);

    await waitFor(() => expect(container.textContent).toContain('Секція C'));
    // Даємо React Query шанс сходити в мережу — його не повинно статись.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(sectionIdCalls).toEqual([]);
  });

  it('контроль: без sectionProducts повертається N+1 — по запиту на секцію', async () => {
    renderRoute(false);

    await waitFor(() => expect(sectionIdCalls).toHaveLength(3));
    expect([...sectionIdCalls].sort()).toEqual(['s1', 's2', 's3']);
  });
});
