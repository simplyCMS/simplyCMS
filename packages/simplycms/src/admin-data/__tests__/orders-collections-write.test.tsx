// @vitest-environment jsdom
// (vitest.config: environment 'node' — патерн on-demand-contract.test.tsx)
/**
 * Колекція замовлень лише на ЧИТАННЯ (Е5-10): `insert` кидає, а повернений
 * `changeOrderStatus` рядок, записаний write-back-ом (К3-7), доходить і до
 * зрізу картки, і до сторінки списку БЕЗ refetch.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { listOrders, makeOrder, reset } from './support/orders-server-stub';
import { SAME, setup } from './support/orders-setup';

vi.mock('simplycms/admin-server', async () => {
  const stub = await import('./support/orders-server-stub');
  return (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
  });
});

describe('колекції замовлень (Е5-10): лише читання і write-back', () => {
  it('collection.insert на orders кидає (колекція лише на читання)', () => {
    const { orders } = setup();
    expect(() => orders.insert(makeOrder(9, SAME))).toThrow();
  });

  it('writeUpsert рядка з новим statusId оновлює і зріз id, і сторінку списку', async () => {
    reset(Array.from({ length: 3 }, (_, i) => makeOrder(i, SAME)));
    const { orders, wrapper, usePages } = setup();
    const { result } = renderHook(
      () => ({
        list: usePages(2),
        card: useLiveQuery((q) =>
          q
            .from({ o: orders })
            .where(({ o }) => eq(o.id, 'o0001'))
            .findOne(),
        ),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
      expect(result.current.card.data?.statusId).toBe('s-new');
    });
    const listCalls = listOrders.mock.calls.length;
    const shown = result.current.list.data[0]!;
    // Явно: рядок списку — НЕ рядок картки (o0001), тож write-back доводиться
    // для двох різних зрізів, а не для одного рядка двічі.
    expect(shown.id).toBe('o0000');
    act(() => {
      orders.utils.writeBatch(() => {
        orders.utils.writeUpsert({ ...shown, statusId: 's-cancelled' });
        orders.utils.writeUpsert({
          ...makeOrder(1, SAME),
          statusId: 's-cancelled',
        });
      });
    });
    await waitFor(() => {
      expect(result.current.card.data?.statusId).toBe('s-cancelled');
      const row = result.current.list.data.find((r) => r.id === shown.id);
      expect(row?.statusId).toBe('s-cancelled');
    });
    expect(listOrders).toHaveBeenCalledTimes(listCalls);
  });
});
