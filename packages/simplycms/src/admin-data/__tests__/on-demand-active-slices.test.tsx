// @vitest-environment jsdom
/**
 * Е3-17 (б): два АКТИВНІ зрізи однієї on-demand колекції + writeUpsert —
 * замір фактичної поведінки. `updateCacheData` (query.ts:2211) перезаписує
 * КОЖЕН кеш-ключ з тим самим префіксом ПОВНИМ поточним syncedData (не лише
 * рядками свого предиката) — але це впливає на ownership-бухгалтерію
 * бібліотеки, а не на видимість: `useLiveQuery` фільтрує матеріалізовані
 * рядки ЧЕРЕЗ where-предикат самого запиту, тож кожен живий запит і далі
 * показує ЛИШЕ свої рядки. Зафіксовано ЯК Є — не Е3-17 (стейл-кеш
 * НЕактивного зрізу), а суміжна поведінка тієї самої механіки.
 */
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createCollection, eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { onDemandCollectionOptions } from '../on-demand-options';

type Row = { id: string; name: string; modificationId: string | null };
const SEED: Row[] = [
  { id: 'r1', name: 'A', modificationId: null },
  { id: 'r2', name: 'B', modificationId: 'm1' },
];

describe('Е3-17 (б): два активні зрізи, writeUpsert', () => {
  it('кожен живий запит бачить ЛИШЕ свої рядки після writeUpsert', async () => {
    const queryClient = new QueryClient();
    const collection = createCollection(
      onDemandCollectionOptions<Row>({
        id: 'active-slices',
        queryClient,
        queryKey: ['active-slices', 'list'],
        getKey: (r) => r.id,
        queryFn: async () => SEED,
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const mod = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ r: collection })
            .where(({ r }) => eq(r.modificationId, 'm1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(mod.result.current.data).toHaveLength(1));

    const zero = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ r: collection }).where(({ r }) => eq(r.id, 'r1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(zero.result.current.data).toHaveLength(1));

    collection.utils.writeUpsert({
      id: 'r2',
      name: 'B-renamed',
      modificationId: 'm1',
    });

    await waitFor(() =>
      expect(mod.result.current.data.find((r) => r.id === 'r2')?.name).toBe(
        'B-renamed',
      ),
    );
    // Обидва живі запити — досі ЛИШЕ свій предикат, надмножина в кеші невидна.
    expect(zero.result.current.data).toHaveLength(1);
    expect(zero.result.current.data[0]?.id).toBe('r1');
    expect(mod.result.current.data).toHaveLength(1);
    expect(mod.result.current.data[0]?.id).toBe('r2');
  });
});
