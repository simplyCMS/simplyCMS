// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Task 0.2: секційні каруселі головної не роблять власних клієнтських
 * запитів — товари приходять із SSR-лоадера через `initialData`.
 * Контрольний кейс (без `initialData`) фіксує старий N+1: 3 секції → 3 запити.
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

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => mockSupabase,
}));

vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <div>{title}</div>,
}));

import { SectionProductCarousel } from '../pages/home/SectionProductCarousel';
import type { HomeProduct, HomeSection } from '../pages/home/types';

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

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderCarousels(withInitialData: boolean) {
  return render(
    <>
      {SECTIONS.map((section) => (
        <SectionProductCarousel
          key={section.id}
          section={section}
          initialData={
            withInitialData ? SECTION_PRODUCTS[section.id] : undefined
          }
        />
      ))}
    </>,
    { wrapper },
  );
}

describe('головна: секційні каруселі не створюють N+1', () => {
  beforeEach(() => {
    sectionIdCalls.length = 0;
  });

  it('3 каруселі з initialData → 0 клієнтських запитів', async () => {
    const { container } = renderCarousels(true);

    await waitFor(() => expect(container.textContent).toContain('Секція C'));
    // Даємо React Query шанс сходити в мережу — його не повинно статись.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(sectionIdCalls).toEqual([]);
  });

  it('контроль: без initialData каруселі роблять по запиту кожна', async () => {
    renderCarousels(false);

    await waitFor(() => expect(sectionIdCalls).toHaveLength(3));
    expect([...sectionIdCalls].sort()).toEqual(['s1', 's2', 's3']);
  });
});
