// @vitest-environment jsdom
/**
 * Редагування позицій у картці (Task 5, Е5б-11): справжні колекції + стаб
 * межі serverFn. Асерти — точні тексти `createTranslator('uk')`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  listOrderItems,
  listOrders,
  makeOrder,
  reset,
  applyOutcome,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
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
const money = (n: number) => formatPrice(n, ENGINE.config).replace(/\s/g, ' ');
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
  it('кількість: один виклик; рядок і підсумки оновлено і після ревалідації', async () => {
    const order = makeOrder(1, at);
    reset([order], [makeItem(1), makeItem(2)]);
    mocks.updateOrderItemQuantity.mockImplementation(async () =>
      applyOutcome({
        order: { ...order, subtotal: '300.00', total: '300.00' },
        upserted: [makeItem(1, { quantity: 3, total: '300.00' })],
        removedIds: [],
      }),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = await qty(1);
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect((input as HTMLInputElement).disabled).toBe(false),
    );
    expect((input as HTMLInputElement).value).toBe('3');
    expect(mocks.updateOrderItemQuantity).toHaveBeenCalledTimes(1);
    expect(mocks.updateOrderItemQuantity).toHaveBeenCalledWith({
      data: { orderId: 'o0001', orderItemId: 'i0001', quantity: 3 },
    });
    // рядок позиції + «Товари» + «Разом» = 3 входження суми
    expect((await screen.findAllByText(money(300))).length).toBe(3);
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    expect(listOrderItems.mock.calls.length).toBeLessThanOrEqual(2);
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    expect(listOrders.mock.calls.length).toBeLessThanOrEqual(2);
    // Ревалідація віддала стан сервера — результат запису не відкотився.
    await new Promise((r) => setTimeout(r, 50));
    expect((input as HTMLInputElement).value).toBe('3');
    expect((await screen.findAllByText(money(300))).length).toBe(3);
  });

  it('409 order_insufficient_stock → тост, поле повертається до серверного', async () => {
    reset([makeOrder(1, at)], [makeItem(1), makeItem(2)]);
    const { AdminConflictError } =
      await import('../../../../../admin-server/impl/errors');
    mocks.updateOrderItemQuantity.mockRejectedValue(
      new AdminConflictError('state', 'order_insufficient_stock'),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = (await qty(1)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        t('admin.errors.orderInsufficientStock'),
      ),
    );
    await waitFor(() => expect(input.value).toBe('1'));
  });

  it('поза межами 1…9999 → виклику немає, поле повертається', async () => {
    reset([makeOrder(1, at)], [makeItem(1), makeItem(2)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = (await qty(1)) as HTMLInputElement;
    for (const bad of ['0', '10000', '']) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.blur(input);
      await waitFor(() => expect(input.value).toBe('1'));
    }
    expect(mocks.updateOrderItemQuantity).not.toHaveBeenCalled();
  });
});
