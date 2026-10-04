// @vitest-environment jsdom
// Діалог додавання товару — відмови й гварди (Task 6, Е5б-11): 409 лишає
// діалог відкритим, подвійний клік — один виклик, скасоване — без кнопки.
import { describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { CANCELLED, makeItem } from './support';
import {
  addButton,
  at,
  conflict,
  deferred,
  hit,
  pick,
  renderPage,
  t,
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

describe('AddOrderItemDialog: додавання', () => {
  it.each([
    ['order_item_not_purchasable', 'admin.errors.orderItemNotPurchasable'],
    ['order_insufficient_stock', 'admin.errors.orderInsufficientStock'],
    ['order_shipping_unavailable', 'admin.errors.orderShippingUnavailable'],
  ] as const)('409 %s: точний тост, діалог відкритий', async (code, key) => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    mocks.addOrderItem.mockRejectedValue(conflict(code));
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    fireEvent.click(addButton());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(t(key)));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(t('admin.orders.addItemTitle')),
    ).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('подвійний клік «Додати» — один виклик', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    const d = deferred<unknown>();
    mocks.addOrderItem.mockReturnValue(d.promise);
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    const btn = addButton();
    // Обидва кліки в одному act: перемальовки між ними немає, тож `disabled`
    // ще не виставлено — доводить саме in-flight ref.
    act(() => {
      btn.click();
      btn.click();
    });
    expect(mocks.addOrderItem).toHaveBeenCalledTimes(1);
    await act(async () =>
      d.resolve({
        order: makeOrder(1, at),
        upserted: [makeItem(2)],
        removedIds: [],
      }),
    );
  });

  it('скасоване замовлення: кнопки «Додати товар» немає', async () => {
    reset([makeOrder(1, at, CANCELLED.id)], [makeItem(1)]);
    renderPage(<OrderDetailPage />);
    await screen.findByText(t('admin.orders.cancelledFinal'));
    expect(
      screen.queryByRole('button', { name: t('admin.orders.addItem') }),
    ).toBeNull();
  });
});
