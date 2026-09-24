// @vitest-environment jsdom
/**
 * Е3-17: ghost-кеш неактивного зрізу on-demand колекції. Механіка — див.
 * `onDemandCollectionOptions` (`on-demand-options.ts`). (а) — ремаунт
 * зрізу «всі рядки» після write-back в іншому зрізі; (в) — той самий
 * сценарій на eager-колекції лишається зеленим БЕЗ фабрики (контроль).
 *
 * Другий `describe` нижче — точне відтворення СИМПТОМУ власника (рев'ю
 * item 4): список гортає `useLiveInfiniteQuery` (як `productsCollection`/
 * `useProductsList`, не голий `useLiveQuery`) з `queryFn`, що поважає
 * РЕАЛЬНІ `limit`/`offset` (не «всі рядки на будь-який запит», інакше
 * тест нічого не доводить — `on-demand-infinite-gc.test.tsx`, item 4).
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createCollection,
  eq,
  useLiveInfiniteQuery,
  useLiveQuery,
} from '@tanstack/react-db';
import {
  parseLoadSubsetOptions,
  queryCollectionOptions,
} from '@tanstack/query-db-collection';
import type { LoadSubsetOptions } from '@tanstack/react-db';
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

type PagedRow = { id: string; name: string; order: number };
const PAGED_SEED: PagedRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Рядок ${i}`,
  order: i,
}));

/**
 * `queryFn` із РЕАЛЬНОЮ пагінацією (limit/offset — як `toSubsetPayload`/
 * `listProducts`) і id-фільтром (для findOne-зрізу картки — той самий шлях,
 * яким `ModificationStatusControl`/`SimpleProductPanel` читають живий
 * рядок). Голе «повернути весь SEED на будь-який запит» (як у (а)/(в)
 * вище) тут не годиться — findOne за id мусить отримати САМЕ той рядок.
 */
async function pagedQueryFn(
  calls: unknown[],
  ctx: { meta?: { loadSubsetOptions?: LoadSubsetOptions } },
) {
  const opts = ctx.meta?.loadSubsetOptions;
  calls.push(opts);
  const { filters, limit } = parseLoadSubsetOptions(opts);
  const idFilter = filters.find(
    (f) => f.field.join('.') === 'id' && f.operator === 'eq',
  );
  if (idFilter) return PAGED_SEED.filter((r) => r.id === idFilter.value);
  const offset = opts?.offset ?? 0;
  return limit === undefined
    ? PAGED_SEED.slice(offset)
    : PAGED_SEED.slice(offset, offset + limit);
}

/**
 * 🔴 Виміряно вручну (item 4): тимчасове закоментування `gcTime: 0` у
 * `onDemandCollectionOptions` (`on-demand-options.ts`) робить ЦЕЙ тест
 * червоним, але маніфестація ІНША за очікувану в описі задачі («лише
 * перейменований рядок»): ремаунт списку бачить УСІ 6 рядків
 * (`toHaveLength(6)` зелений), але СТЕЙЛ ЗНАЧЕННЯ для того, що
 * перейменували — `byId.get('r2')` повертає ДОреймейн `'Рядок 2'`, не
 * `'Рядок 2 (перейменовано)'`. Пояснення: ghost-кеш сторінки списку, що
 * містить r2, не інвалідується write-back-ом, поки список розмонтований
 * (без `gcTime: 0` він не прибирається одразу — коментар фабрики), і
 * ремаунт читає ЦЕЙ застиглий кеш напряму (React Query не рефетчить дані,
 * які вважає «не stale»), а не мовчки звужує список до одного рядка.
 * Обидва — прояви одного дефекту (ghost-кеш неактивного зрізу), різниця —
 * лише в ТОМУ, ЩО САМЕ застигає: кількість рядків (сценарій (а) вище,
 * голий `useLiveQuery`) чи значення поля (тут, `useLiveInfiniteQuery`).
 */
describe('Е3-17 (симптом власника): список useLiveInfiniteQuery + findOne-картка', () => {
  it('ремаунт списку після write-back у findOne-зрізі бачить УСІ 6 рядків, не лише перейменований', async () => {
    const queryClient = new QueryClient();
    const calls: unknown[] = [];
    const collection = createCollection(
      onDemandCollectionOptions<PagedRow>({
        id: 'paged',
        queryClient,
        queryKey: ['paged', 'list'],
        getKey: (r) => r.id,
        queryFn: (ctx) => pagedQueryFn(calls, ctx),
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Список — той самий патерн, що productsCollection/useProductsList:
    // useLiveInfiniteQuery, pageSize < довжини набору, orderBy для індексу.
    const list = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) => q.from({ r: collection }).orderBy(({ r }) => r.order, 'asc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(list.result.current.data).toHaveLength(2));
    await act(async () => void list.result.current.fetchNextPage());
    await waitFor(() => expect(list.result.current.data).toHaveLength(4));
    await act(async () => void list.result.current.fetchNextPage());
    await waitFor(() => expect(list.result.current.data).toHaveLength(6));
    list.unmount();

    // Картка — ЄДИНИЙ активний зріз: findOne за id (ModificationStatusControl/
    // SimpleProductPanel над живим рядком).
    const card = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ r: collection })
            .where(({ r }) => eq(r.id, 'r2'))
            .findOne(),
        ),
      { wrapper },
    );
    await waitFor(() => expect(card.result.current.data?.name).toBe('Рядок 2'));
    collection.utils.writeUpsert({
      id: 'r2',
      name: 'Рядок 2 (перейменовано)',
      order: 2,
    });
    await waitFor(() =>
      expect(card.result.current.data?.name).toBe('Рядок 2 (перейменовано)'),
    );
    card.unmount();

    // Ремаунт списку — свіжий useLiveInfiniteQuery-хук, довантажуємо ті
    // самі 3 сторінки.
    const again = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) => q.from({ r: collection }).orderBy(({ r }) => r.order, 'asc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() =>
      expect(again.result.current.data.length).toBeGreaterThan(0),
    );
    await act(async () => void again.result.current.fetchNextPage());
    await act(async () => void again.result.current.fetchNextPage());
    await waitFor(() => expect(again.result.current.data).toHaveLength(6));

    const byId = new Map(again.result.current.data.map((r) => [r.id, r.name]));
    expect(byId.get('r2')).toBe('Рядок 2 (перейменовано)');
    expect([...byId.keys()].sort()).toEqual(PAGED_SEED.map((r) => r.id).sort());
  });
});
