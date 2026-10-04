// @vitest-environment jsdom
// Діалог додавання товару — пошук (Task 6, Е5б-11): debounce 300 мс,
// відповідь лише на ОСТАННІЙ запит. Тексти — `createTranslator('uk')`.
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  deferred,
  hit,
  t,
  tick,
  type,
  openDialog as open,
  registerDialogTestState,
} from './add-dialog-support';

const mocks = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  searchProductsForOrder: vi.fn(),
  listProductModifications: vi.fn(),
  addOrderItem: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listOrderStatuses: mocks.listOrderStatuses,
    searchProductsForOrder: mocks.searchProductsForOrder,
    listProductModifications: mocks.listProductModifications,
    addOrderItem: mocks.addOrderItem,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';

const openDialog = () => open(<OrderDetailPage />);
registerDialogTestState(mocks);

describe('AddOrderItemDialog: пошук', () => {
  it('менше 2 символів — запиту немає, лише підказка; debounce 300 мс', async () => {
    const input = await openDialog();
    vi.useFakeTimers();
    mocks.searchProductsForOrder.mockResolvedValue({ items: [] });
    expect(screen.getByText(t('admin.orders.searchHint'))).toBeTruthy();
    type(input, 'a');
    await tick(500);
    expect(mocks.searchProductsForOrder).not.toHaveBeenCalled();
    type(input, 'ab');
    await tick(299);
    expect(mocks.searchProductsForOrder).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledTimes(1);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledWith({
      data: { query: 'ab' },
    });
    expect(screen.getByText(t('admin.orders.searchEmpty'))).toBeTruthy();
  });

  it('застаріла відповідь не перетирає нову (відповіді у зворотному порядку)', async () => {
    const input = await openDialog();
    vi.useFakeTimers();
    const a = deferred<{ items: ReturnType<typeof hit>[] }>();
    const b = deferred<{ items: ReturnType<typeof hit>[] }>();
    mocks.searchProductsForOrder
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    type(input, 'ab');
    await tick(300);
    type(input, 'abc');
    await tick(300);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledTimes(2);
    await act(async () => b.resolve({ items: [hit('pb', 'Новий збіг')] }));
    await act(async () => a.resolve({ items: [hit('pa', 'Застарілий збіг')] }));
    expect(screen.getByText('Новий збіг')).toBeTruthy();
    expect(screen.queryByText('Застарілий збіг')).toBeNull();
  });
});
