// @vitest-environment jsdom
// (vitest.config: environment 'node' — патерн on-demand-contract.test.tsx)
/**
 * Колекції замовлень і позицій (Task 5 Е5, Е5-10): сторінки й зрізи на
 * СПРАВЖНІЙ `@tanstack/db` з одним QueryClient. Мокнуто лише межу serverFn —
 * стаб (`support/orders-server-stub.ts`) фільтрує фікстуру за subset,
 * дописує тай-брейкер `id` і застосовує `maxLimit` як сервер. Запис —
 * `orders-collections-write.test.tsx`.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { OrderItem } from 'simplycms/schema/types';
import {
  listOrderItems,
  listOrders,
  makeOrder,
  reset,
  server,
} from './support/orders-server-stub';
import { ids, PAGE, SAME, setup } from './support/orders-setup';

vi.mock('simplycms/admin-server', async () => {
  const stub = await import('./support/orders-server-stub');
  return (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
  });
});

describe('колекції замовлень (Е5-10)', () => {
  it('useLiveInfiniteQuery по createdAt desc з індексом: 3 сторінки по 2 без дублів і пропусків при однакових createdAt (Review Focus 5)', async () => {
    reset(Array.from({ length: 6 }, (_, i) => makeOrder(i, SAME)));
    const { wrapper, usePages } = setup();
    const { result } = renderHook(() => usePages(2), { wrapper });
    for (const n of [2, 4, 6]) {
      await waitFor(() => expect(result.current.data).toHaveLength(n));
      expect(new Set(ids(result.current.data)).size).toBe(n);
      if (n < 6) {
        expect(result.current.hasNextPage).toBe(true);
        await act(async () => result.current.fetchNextPage());
      }
    }
    expect([...ids(result.current.data)].sort()).toEqual(
      ids(server.orders).sort(),
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('101 замовлення (maxLimit + 1), стаб застосовує maxLimit = 100 як сервер: сторінками по ORDERS_PAGE_SIZE доходимо до 101-го, hasNextPage стає false лише в кінці', async () => {
    // Групи по 7 з однаковою міткою перетинають межі сторінок (50, 100) —
    // тай-брейкер мусить тримати порядок і на великому наборі.
    const base = SAME.getTime();
    reset(
      Array.from({ length: 101 }, (_, i) =>
        makeOrder(i, new Date(base - Math.floor(i / 7) * 60_000)),
      ),
    );
    const { wrapper, usePages } = setup();
    const { result } = renderHook(() => usePages(PAGE), { wrapper });
    for (const n of [50, 100, 101]) {
      await waitFor(() => expect(result.current.data).toHaveLength(n));
      expect(new Set(ids(result.current.data)).size).toBe(n);
      if (n < 101) {
        expect(result.current.hasNextPage).toBe(true);
        await act(async () => result.current.fetchNextPage());
      }
    }
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    for (const [{ data }] of listOrders.mock.calls)
      expect(data.subset?.limit ?? 0).toBeLessThanOrEqual(100);
  });

  it('зріз where statusId — лише замовлення статусу', async () => {
    reset([
      makeOrder(1, SAME, 's-new'),
      makeOrder(2, SAME, 's-done'),
      makeOrder(3, SAME, 's-new'),
    ]);
    const { orders, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ o: orders }).where(({ o }) => eq(o.statusId, 's-new')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(ids(result.current.data).sort()).toEqual(['o0001', 'o0003']);
    expect(JSON.stringify(listOrders.mock.calls)).toContain('"statusId"');
  });

  it('orderItems: зріз where orderId', async () => {
    const item = (id: string, orderId: string) =>
      ({ id, orderId, name: id, quantity: 1 }) as OrderItem;
    reset([], [item('i1', 'o1'), item('i2', 'o2'), item('i3', 'o1')]);
    const { items, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ i: items }).where(({ i }) => eq(i.orderId, 'o1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(ids(result.current.data).sort()).toEqual(['i1', 'i3']);
    expect(JSON.stringify(listOrderItems.mock.calls)).toContain('"orderId"');
  });
});
