// @vitest-environment jsdom
/**
 * TSDB-1, симптом (а): що лежить у кеш-ключі НЕАКТИВНОГО зрізу on-demand
 * колекції після write-back з іншого зрізу, і що бачить ремаунт. Фабрика
 * (`on-demand-options.ts`) `gcTime` НЕ ставить — тест доводить, що без
 * обходу запис зрізу A не лишається стейл/обрізаним. Сервер зі станом
 * (`support/mutable-server.ts`): відповіді ревалідації авторитетні.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createCollection,
  eq,
  useLiveInfiniteQuery,
  useLiveQuery,
} from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';
import { persistenceHandlers, type WriteBack } from '../handlers';
import { createMutableServer, type Payload } from './support/mutable-server';
import { awaitRevalidation } from './support/revalidation';

type Row = { id: string; name: string; order: number };
const SEED: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Рядок ${i}`,
  order: i,
}));
const BASE = ['inactive-key', 'list'] as const;

function setup() {
  const server = createMutableServer(SEED);
  // Як production-queryFn: loadSubsetOptions -> subset-payload -> сервер.
  const list = vi.fn((ctx: { meta?: { loadSubsetOptions?: unknown } }) =>
    server.list({
      data: toSubsetPayload(
        ctx.meta?.loadSubsetOptions as Parameters<typeof toSubsetPayload>[0],
      ) as Payload,
    }),
  );
  // Ті самі defaultOptions, що в продакшені: `src/router.tsx:17-19`.
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  });
  const ref: { current?: WriteBack<Row> } = {};
  const collection = createCollection(
    onDemandCollectionOptions<Row>({
      id: 'inactive-key',
      queryClient: qc,
      queryKey: BASE,
      getKey: (r) => r.id,
      queryFn: (ctx) => list(ctx as never),
      ...persistenceHandlers<Row>(() => ref.current!, {
        entity: 'inactive-key',
        update: async ({ data }) => {
          const patches = data as unknown as {
            id: string;
            patch: Partial<Row>;
          }[];
          return patches.map((p) =>
            server.upsert({ id: p.id, ...p.patch } as Row),
          );
        },
      }),
    }),
  );
  ref.current = collection;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { collection, qc, wrapper, list, server };
}

const useListQuery = (c: ReturnType<typeof setup>['collection']) =>
  useLiveInfiniteQuery(
    (q) => q.from({ r: c }).orderBy(({ r }) => r.order, 'asc'),
    { pageSize: 2 },
  );
const names = (rows: readonly Row[]) => rows.map((r) => r.name);

describe('TSDB-1 (а): вміст кеш-ключів неактивного зрізу', () => {
  it('після write-back зі зрізу-картки B ремаунт списку A бачить ПОВНИЙ набір з оновленим X', async () => {
    const { collection, qc, wrapper, list, server } = setup();
    const a = renderHook(() => useListQuery(collection), { wrapper });
    await waitFor(() => expect(a.result.current.data).toHaveLength(2));
    for (const n of [4, 6]) {
      await act(async () => void a.result.current.fetchNextPage());
      await waitFor(() => expect(a.result.current.data).toHaveLength(n));
    }
    a.unmount();

    const b = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ r: collection })
            .where(({ r }) => eq(r.id, 'r2'))
            .findOne(),
        ),
      { wrapper },
    );
    await waitFor(() => expect(b.result.current.data?.name).toBe('Рядок 2'));
    const before = list.mock.calls.length;
    await act(async () => {
      collection.update('r2', (d) => {
        d.name = 'Рядок 2 (перейменовано)';
      });
    });
    await awaitRevalidation(list as never, before);
    // Контракт: після запису жоден кешований ключ колекції не містить
    // стейл-рядка — кожен рядок у кеші збігається з поточним станом сервера
    // (за id), і не вилучений ключ втратив дані. Кількість запитів — не
    // магічне число: кожен кешований ключ ревалідується рівно раз (M1).
    const queries = qc.getQueryCache().findAll({ queryKey: BASE });
    const current = new Map(server.rows.map((r) => [r.id, r]));
    for (const q of queries) {
      expect(q.state.data).toBeDefined();
      for (const row of q.state.data as Row[])
        expect(row).toEqual(current.get(row.id));
    }
    expect(list.mock.calls.length - before).toBe(queries.length);
    b.unmount();

    const again = renderHook(() => useListQuery(collection), { wrapper });
    await waitFor(() =>
      expect(again.result.current.data.length).toBeGreaterThan(0),
    );
    for (const n of [4, 6]) {
      await act(async () => void again.result.current.fetchNextPage());
      await waitFor(() => expect(again.result.current.data).toHaveLength(n));
    }
    expect(names(again.result.current.data)).toEqual(
      SEED.map((r) => (r.id === 'r2' ? 'Рядок 2 (перейменовано)' : r.name)),
    );
  });
});
