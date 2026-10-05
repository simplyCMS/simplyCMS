// @vitest-environment jsdom
/** `useOrderItemsEdit.add` (Task 5, Е5б-11): write-back відповіді в обидві колекції. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  listOrderItems,
  makeOrder,
  reset,
  applyOutcome,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { awaitRevalidation } from '../../../../../admin-data/__tests__/support/revalidation';
import { makeItem, NEW } from './support';

const mocks = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  addOrderItem: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listOrderStatuses: mocks.listOrderStatuses,
    addOrderItem: mocks.addOrderItem,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';
import { useOrderItemsEdit } from '../useOrderItemsEdit';
import { renderHook, act } from '@testing-library/react';

let client = new QueryClient();
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient();
  mocks.listOrderStatuses.mockResolvedValue([NEW]);
});
afterEach(cleanup);

describe('useOrderItemsEdit.add', () => {
  it('add: write-back додає позицію й оновлює замовлення, ревалідація її зберігає', async () => {
    const at = new Date(Date.UTC(2026, 9, 1, 10));
    const order = makeOrder(1, at);
    reset([order], [makeItem(1)]);
    mocks.addOrderItem.mockImplementation(async () =>
      applyOutcome({
        order: { ...order, subtotal: '250.00', total: '250.00' },
        upserted: [makeItem(2, { price: '150.00', total: '150.00' })],
        removedIds: [],
      }),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText('Товар 1');
    // Той самий QueryClient → ті самі колекції, що й у сторінки.
    const { result } = renderHook(() => useOrderItemsEdit('o0001'), {
      wrapper: wrap,
    });
    const before = listOrderItems.mock.calls.length;
    await act(async () => {
      await result.current.add({
        productId: 'p1',
        modificationId: null,
        quantity: 1,
      });
    });
    expect(mocks.addOrderItem).toHaveBeenCalledWith({
      data: {
        orderId: 'o0001',
        productId: 'p1',
        modificationId: null,
        quantity: 1,
      },
    });
    expect(await screen.findByText('Товар 2')).toBeTruthy();
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    await awaitRevalidation(listOrderItems, before);
    expect(listOrderItems.mock.calls.length).toBeLessThanOrEqual(before + 1);
  });
});
