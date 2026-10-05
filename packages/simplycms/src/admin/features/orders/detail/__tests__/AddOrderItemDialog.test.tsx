// @vitest-environment jsdom
// Діалог додавання товару — додавання (Task 6, Е5б-11): вибір модифікації,
// межі кількості, успіх — write-back без `listOrderItems`.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  listOrderItems,
  makeOrder,
  applyOutcome,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { makeItem } from './support';
import {
  addButton,
  at,
  hit,
  pick,
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
  it('товар без модифікацій: modificationId null, кількість з поля', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    mocks.addOrderItem.mockImplementation(async () =>
      applyOutcome({
        order: makeOrder(1, at),
        upserted: [makeItem(2)],
        removedIds: [],
      }),
    );
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    fireEvent.change(screen.getByLabelText(t('common.quantity')), {
      target: { value: '3' },
    });
    fireEvent.click(addButton());
    await waitFor(() => expect(mocks.addOrderItem).toHaveBeenCalledTimes(1));
    expect(mocks.addOrderItem).toHaveBeenCalledWith({
      data: {
        orderId: 'o0001',
        productId: 'p1',
        modificationId: null,
        quantity: 3,
      },
    });
    // Успіх: діалог закрито, позиція — write-back без listOrderItems.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Товар 2')).toBeTruthy();
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    expect(listOrderItems.mock.calls.length).toBeLessThanOrEqual(2);
    // Ревалідація віддала стан сервера — результат запису не відкотився.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Товар 2')).toBeTruthy();
  });

  it('товар із модифікаціями: «Додати» вимкнена до вибору модифікації', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p2', 'Із варіантами', true)],
    });
    mocks.addOrderItem.mockImplementation(async () =>
      applyOutcome({
        order: makeOrder(1, at),
        upserted: [makeItem(2)],
        removedIds: [],
      }),
    );
    const input = await openDialog();
    type(input, 'із');
    await pick('Із варіантами');
    expect(
      await screen.findByText(
        t('admin.orders.pickModification', { name: 'Із варіантами' }),
      ),
    ).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: /Червоний/ }));
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(addButton());
    await waitFor(() =>
      expect(mocks.addOrderItem).toHaveBeenCalledWith({
        data: {
          orderId: 'o0001',
          productId: 'p2',
          modificationId: 'm1',
          quantity: 1,
        },
      }),
    );
  });

  it('кількість поза 1…9999 — «Додати» вимкнена', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    const q = screen.getByLabelText(t('common.quantity'));
    for (const bad of ['0', '10000', '']) {
      fireEvent.change(q, { target: { value: bad } });
      expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.change(q, { target: { value: '9999' } });
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
  });
});
