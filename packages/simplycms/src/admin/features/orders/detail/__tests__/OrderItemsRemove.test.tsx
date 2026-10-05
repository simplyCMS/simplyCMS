// @vitest-environment jsdom
/**
 * Видалення й додавання позицій, скасоване замовлення (Task 5, Е5б-11): справжні колекції + стаб
 * межі serverFn. Асерти — точні тексти `createTranslator('uk')`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  listOrderItems,
  makeOrder,
  reset,
  applyOutcome,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { awaitRevalidation } from '../../../../../admin-data/__tests__/support/revalidation';
import { CANCELLED, makeItem, NEW } from './support';

const mocks = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  updateOrderItemQuantity: vi.fn(),
  removeOrderItem: vi.fn(),
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
    updateOrderItemQuantity: mocks.updateOrderItemQuantity,
    removeOrderItem: mocks.removeOrderItem,
    addOrderItem: mocks.addOrderItem,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';

const t = createTranslator('uk');
let client = new QueryClient();
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);
const at = new Date(Date.UTC(2026, 9, 1, 10));
const qty = (n: number) =>
  screen.findByLabelText(`${t('common.quantity')}: Товар ${n}`);

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient();
  mocks.listOrderStatuses.mockResolvedValue([NEW, CANCELLED]);
});
afterEach(cleanup);

describe('OrderDetailPage: редагування позицій', () => {
  it('видалення через діалог: «Скасувати» — без виклику; підтвердження — один виклик і write-back', async () => {
    const order = makeOrder(1, at);
    reset([order], [makeItem(1), makeItem(2)]);
    mocks.removeOrderItem.mockImplementation(async () =>
      applyOutcome({
        order,
        upserted: [],
        removedIds: ['i0002'],
      }),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    const open = () =>
      screen.findByRole('button', { name: `${t('common.delete')}: Товар 2` });
    fireEvent.click(await open());
    let dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        t('admin.orders.removeItemText', { name: 'Товар 2' }),
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.cancel') }),
    );
    expect(mocks.removeOrderItem).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(await open());
    dialog = await screen.findByRole('alertdialog');
    const before = listOrderItems.mock.calls.length;
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    expect(mocks.removeOrderItem).toHaveBeenCalledTimes(1);
    expect(mocks.removeOrderItem).toHaveBeenCalledWith({
      data: { orderId: 'o0001', orderItemId: 'i0002' },
    });
    await waitFor(() => expect(screen.queryByText('Товар 2')).toBeNull());
    expect(screen.queryByText('Товар 1')).toBeTruthy();
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    await awaitRevalidation(listOrderItems, before);
    expect(listOrderItems.mock.calls.length).toBeLessThanOrEqual(before + 1);
    // Ревалідація віддала стан сервера — результат запису не відкотився.
    expect(screen.queryByText('Товар 2')).toBeNull();
    expect(screen.queryByText('Товар 1')).toBeTruthy();
  });

  it('остання позиція: кнопки видалення немає', async () => {
    reset([makeOrder(1, at)], [makeItem(1)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    await qty(1);
    expect(screen.queryByRole('button', { name: /^Видалити: / })).toBeNull();
  });

  it('скасоване замовлення: ні поля кількості, ні кнопки видалення', async () => {
    reset([makeOrder(1, at, CANCELLED.id)], [makeItem(1), makeItem(2)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText('Товар 1');
    await screen.findByText(t('admin.orders.cancelledFinal'));
    expect(screen.queryByLabelText(/^Кількість: /)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Видалити: / })).toBeNull();
  });
});
