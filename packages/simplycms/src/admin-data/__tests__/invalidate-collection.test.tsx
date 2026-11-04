// @vitest-environment jsdom
/**
 * `invalidateCollection` — перечитування колекції після ЧУЖОЇ операції, що
 * змінила її таблицю (сервер змінено напряму, write-back немає). Справжня
 * on-demand колекція, продакшен-`defaultOptions` (`staleTime` 5 хв,
 * `src/router.tsx`), форма сторінок адмінки:
 * - список (`useLiveInfiniteQuery`) розмонтовано, поки відкрита картка, довше
 *   за `gcTime` живого запиту (5 с, `@tanstack/db` collection-config-builder) —
 *   після інвалідації його ремаунт приходить із сервера. `utils.refetch()`
 *   цього не робить: перезапитує лише живий зріз картки, а ремаунт списку бере
 *   застарілий кеш (виміряно 2026-11-04, мутацією);
 * - живий зріз перечитується одразу.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createCollection,
  eq,
  useLiveInfiniteQuery,
  useLiveQuery,
} from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import { onDemandCollectionOptions } from '../on-demand-options';
import { getCollection, type CollectionDef } from '../registry';
import { invalidateCollection } from '../invalidate-collection';
import { toSubsetPayload } from '../subset-payload';
import { createMutableServer, type Payload } from './support/mutable-server';

// Авто-cleanup RTL у репо вимкнено (globals: false) — знімаємо дерево самі.
afterEach(cleanup);

type Row = { id: string; name: string; order: number };
/** Дефолтний `gcTime` живого запиту — 5 с; чекаємо з запасом. */
const LIVE_QUERY_GC_MS = 5000;

function setup() {
  const server = createMutableServer<Row>(
    Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`,
      name: `Рядок ${i}`,
      order: i,
    })),
  );
  // Як production-queryFn: loadSubsetOptions -> subset-payload -> сервер.
  const list = vi.fn((ctx: { meta?: { loadSubsetOptions?: unknown } }) =>
    server.list({
      data: toSubsetPayload(
        ctx.meta?.loadSubsetOptions as Parameters<typeof toSubsetPayload>[0],
      ) as Payload,
    }),
  );
  const make = (queryClient: QueryClient) =>
    createCollection(
      onDemandCollectionOptions<Row>({
        id: 'invalidate-probe',
        queryClient,
        queryKey: collectionKey(ENTITY.products),
        getKey: (r) => r.id,
        queryFn: (ctx) => list(ctx as never),
      }),
    );
  const def: CollectionDef<ReturnType<typeof make>> = {
    id: ENTITY.products,
    create: make,
  };
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  });
  const collection = getCollection(qc, def);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const useList = () =>
    useLiveInfiniteQuery(
      (q) => q.from({ r: collection }).orderBy(({ r }) => r.order, 'asc'),
      { pageSize: 2 },
    );
  const useCard = (id: string) => () =>
    useLiveQuery((q) =>
      q
        .from({ r: collection })
        .where(({ r }) => eq(r.id, id))
        .findOne(),
    );
  return { server, def, qc, wrapper, useList, useCard };
}

describe('invalidateCollection', () => {
  it(
    'список, зібраний під відкритою карткою, після інвалідації приходить із сервера',
    { timeout: 20_000 },
    async () => {
      const { server, def, qc, wrapper, useList, useCard } = setup();
      const list = renderHook(useList, { wrapper });
      await waitFor(() => expect(list.result.current.data).toHaveLength(2));
      list.unmount();
      // Повільний свідомо: справжній `gcTime` живого запиту (опції в
      // `useLiveInfiniteQuery` немає) — лише після нього зріз списку лишається
      // в кеші QueryClient без спостерігача.
      await act(
        () => new Promise((r) => setTimeout(r, LIVE_QUERY_GC_MS + 500)),
      );
      const card = renderHook(useCard('r3'), { wrapper });
      await waitFor(() =>
        expect(card.result.current.data?.name).toBe('Рядок 3'),
      );
      // Чужа операція (напр. `products.setPath` піднімає version) змінила
      // рядок списку на сервері, відповідь його не несе.
      server.upsert({ id: 'r0', name: 'Змінено', order: 0 });
      await act(() => invalidateCollection(qc, def));
      // Список повертається, поки живий запит картки ще тримає колекцію
      // (його `gcTime` 5 с після навігації): без підписника колекція
      // перечитала б усе сама, і тест не розрізняв би механізми.
      const again = renderHook(useList, { wrapper });
      await waitFor(() =>
        expect(again.result.current.data[0]?.name).toBe('Змінено'),
      );
    },
  );

  it('живий зріз перечитується одразу', async () => {
    const { server, def, qc, wrapper, useCard } = setup();
    const card = renderHook(useCard('r1'), { wrapper });
    await waitFor(() => expect(card.result.current.data?.name).toBe('Рядок 1'));
    server.upsert({ id: 'r1', name: 'Оновлено', order: 1 });
    await act(() => invalidateCollection(qc, def));
    await waitFor(() =>
      expect(card.result.current.data?.name).toBe('Оновлено'),
    );
  });
});
