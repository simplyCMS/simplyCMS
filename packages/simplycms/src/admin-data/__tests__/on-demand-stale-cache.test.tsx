// @vitest-environment jsdom
/**
 * Е3-17: ghost-кеш неактивного зрізу on-demand колекції. Механіка — див.
 * `onDemandCollectionOptions` (`on-demand-options.ts`). (а) — ремаунт
 * зрізу «всі рядки» після write-back в іншому зрізі; (в) — той самий
 * сценарій на eager-колекції лишається зеленим БЕЗ фабрики (контроль).
 */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createCollection, eq, useLiveQuery } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { ReactNode } from 'react';
import { onDemandCollectionOptions } from '../on-demand-options';

type Row = { id: string; name: string };
const SEED: Row[] = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B' },
  { id: 'p3', name: 'C' },
];

function makeCollection(mode: 'on-demand' | 'eager') {
  const queryClient = new QueryClient();
  const base = {
    id: 'stale',
    queryClient,
    queryKey: ['stale', 'list'] as const,
    getKey: (r: Row) => r.id,
    queryFn: async () => SEED,
  };
  const collection =
    mode === 'on-demand'
      ? createCollection(onDemandCollectionOptions<Row>(base))
      : createCollection(queryCollectionOptions<Row>(base));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { collection, wrapper };
}

/** Спільний сценарій (а): зріз A монтується/розмонтовується, зріз B пише
 * рядок write-back-ом, зріз A монтується заново. */
async function remountAfterWriteBack(mode: 'on-demand' | 'eager') {
  const { collection, wrapper } = makeCollection(mode);

  const all = renderHook(() => useLiveQuery((q) => q.from({ p: collection })), {
    wrapper,
  });
  await waitFor(() => expect(all.result.current.data).toHaveLength(3));
  all.unmount();

  const one = renderHook(
    () =>
      useLiveQuery((q) =>
        q
          .from({ p: collection })
          .where(({ p }) => eq(p.id, 'p2'))
          .findOne(),
      ),
    { wrapper },
  );
  await waitFor(() => expect(one.result.current.data?.name).toBe('B'));
  collection.utils.writeUpsert({ id: 'p2', name: 'B-renamed' });
  await waitFor(() => expect(one.result.current.data?.name).toBe('B-renamed'));
  one.unmount();

  const again = renderHook(
    () => useLiveQuery((q) => q.from({ p: collection })),
    { wrapper },
  );
  await waitFor(() => expect(again.result.current.isReady).toBe(true));
  return again.result.current.data;
}

describe('Е3-17: on-demand без стейл-кешу підзапитів', () => {
  it('(а) через onDemandCollectionOptions — ремаунт бачить усі рядки, включно з перейменованим', async () => {
    const data = await remountAfterWriteBack('on-demand');
    expect(data).toHaveLength(3);
    expect(data.find((r) => r.id === 'p2')?.name).toBe('B-renamed');
  });

  it('(в, контроль) eager-колекція — той самий сценарій зелений і без фабрики', async () => {
    const data = await remountAfterWriteBack('eager');
    expect(data).toHaveLength(3);
    expect(data.find((r) => r.id === 'p2')?.name).toBe('B-renamed');
  });
});
