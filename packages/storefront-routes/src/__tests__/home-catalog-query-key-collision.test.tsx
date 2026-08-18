// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { catalogKeys } from '@simplycms/react-query';
import { useSectionProducts } from '../pages/home/queries';

/**
 * Регрес фази 3 (пункт G): `useSectionProducts` (карусель головної) і
 * `useCatalogProductsQuery` (сторінка розділу) раніше ділили один сирий
 * ключ `['section-products', sectionId]` — кеш однієї сторінки міг
 * підмінити дані іншої для того самого розділу. Доводимо саме ізоляцію
 * кешу: рядок, попередньо покладений під СТАРИЙ сирий ключ, не повинен
 * прилетіти як дані хука головної — той тепер живе під
 * `catalogKeys.sectionProducts(...)`.
 */

const SECTION_ID = 'sec-1';

/** Thenable-білдер, що завжди резолвиться заданими даними. */
function createSupabaseStub(rows: unknown[]) {
  const result = { data: rows, error: null };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.then = <TResult,>(onfulfilled: (value: typeof result) => TResult) =>
    Promise.resolve(result).then(onfulfilled);

  return { from: () => builder };
}

const freshRow = {
  id: 'fresh-product',
  name: 'Свіжий товар',
  slug: 'fresh-product',
  images: null,
  short_description: null,
  stock_status: 'in_stock',
  sections: { slug: 'panels' },
};

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => createSupabaseStub([freshRow]),
}));

describe('useSectionProducts — не ділить ключ кешу з каталогом розділу', () => {
  it('ігнорує дані, покладені під старий сирий ключ каталогу', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Симулюємо кеш сторінки розділу каталогу, залишений старим сирим
    // ключем — саме той, з яким колізувала карусель головної до фіксу.
    const catalogPageCacheSentinel = [{ id: 'catalog-page-product' }];
    qc.setQueryData(['section-products', SECTION_ID], catalogPageCacheSentinel);

    function wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(
      () =>
        useSectionProducts({
          id: SECTION_ID,
          name: 'Панелі',
          slug: 'panels',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Дані хука — свої (fetched), а не підмінені сентинелом каталогу.
    expect(result.current.data).toEqual([
      {
        id: 'fresh-product',
        name: 'Свіжий товар',
        slug: 'fresh-product',
        images: [],
        short_description: null,
        stock_status: 'in_stock',
        section: { slug: 'panels' },
      },
    ]);
    expect(result.current.data).not.toEqual(catalogPageCacheSentinel);

    // Іменований ключ хука — фабрика react-query, не сирий рядок каталогу.
    expect(qc.getQueryData(catalogKeys.sectionProducts(SECTION_ID))).toEqual(
      result.current.data,
    );
  });
});
