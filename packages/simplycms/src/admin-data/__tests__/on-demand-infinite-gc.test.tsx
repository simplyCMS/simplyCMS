// @vitest-environment jsdom
/**
 * Е3-17, п.4: чи не ламає `gcTime: 0` (фабрика) `useLiveInfiniteQuery` —
 * «Показати ще» кілька разів + ререндер не губить сторінки і не
 * перезапитує вже видимі. Якби ЦЕЙ тест почервонів — фікс Е3-17 довелося б
 * переглядати (запасний варіант архітектора — `removeQueries` inactive у
 * write-шляху); тут gcTime:0 сторінкам не заважає.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createCollection, useLiveInfiniteQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { onDemandCollectionOptions } from '../on-demand-options';

type Row = { id: string; order: number };
const SEED: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  order: i,
}));

describe('Е3-17 (4): useLiveInfiniteQuery з gcTime:0', () => {
  it('сторінки не губляться на ререндер, повторних запитів на видимі сторінки немає', async () => {
    const queryClient = new QueryClient();
    const calls: unknown[] = [];
    const collection = createCollection(
      onDemandCollectionOptions<Row>({
        id: 'infinite-gc',
        queryClient,
        queryKey: ['infinite-gc', 'list'],
        getKey: (r) => r.id,
        queryFn: async (ctx) => {
          calls.push(ctx.meta?.loadSubsetOptions);
          return SEED;
        },
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) => q.from({ r: collection }).orderBy(({ r }) => r.order, 'asc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    await act(async () => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(4));

    await act(async () => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(6));

    const callsAfterPaging = calls.length;
    rerender();
    // Ререндер БЕЗ нового fetchNextPage — сторінки лишаються на місці, і
    // запитів на вже видимі сторінки не додається.
    expect(result.current.data).toHaveLength(6);
    expect(calls.length).toBe(callsAfterPaging);
    expect(result.current.data.map((r) => r.id)).toEqual(SEED.map((r) => r.id));
  });
});
