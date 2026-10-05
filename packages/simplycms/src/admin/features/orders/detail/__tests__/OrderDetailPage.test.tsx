// @vitest-environment jsdom
/**
 * Картка замовлення (Task 7, Е5): справжні колекції + стаб межі serverFn.
 * Асерти — точні тексти `createTranslator('uk')`.
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
  listOrders,
  makeOrder,
  reset,
  applyOutcome,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { awaitRevalidation } from '../../../../../admin-data/__tests__/support/revalidation';
import { NEW, CANCELLED, DONE } from './support';

const { listOrderStatuses, changeOrderStatus, toastError, params } = vi.hoisted(
  () => ({
    listOrderStatuses: vi.fn(),
    changeOrderStatus: vi.fn(),
    toastError: vi.fn(),
    params: { orderId: 'o0001' },
  }),
);
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listOrderStatuses,
    changeOrderStatus,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => params,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';

const t = createTranslator('uk');
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);
const at = new Date(Date.UTC(2026, 9, 1, 10));
const select = () =>
  screen.findByRole('combobox', { name: t('admin.orders.statusSection') });

beforeEach(() => {
  vi.clearAllMocks();
  params.orderId = 'o0001';
  listOrderStatuses.mockResolvedValue([NEW, DONE, CANCELLED]);
});
afterEach(cleanup);

describe('OrderDetailPage', () => {
  it('скасоване замовлення: контрол статусу disabled, підказка cancelledFinal', async () => {
    reset([makeOrder(1, at, CANCELLED.id)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    expect((await select()).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(t('admin.orders.cancelledFinal'))).toBeTruthy();
  });

  it('вибір «Скасоване» → AlertDialog з попередженням; «Скасувати» в діалозі → виклику немає', async () => {
    reset([makeOrder(1, at)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    fireEvent.change(await select(), { target: { value: CANCELLED.id } });
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.orders.cancelWarning')),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.cancel') }),
    );
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  it('підтвердження → один виклик; write-back оновлює статус, ревалідація його зберігає', async () => {
    const order = makeOrder(1, at);
    reset([order]);
    changeOrderStatus.mockImplementation(async () =>
      applyOutcome({
        order: { ...order, statusId: CANCELLED.id },
      }),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    fireEvent.change(await select(), { target: { value: CANCELLED.id } });
    const dialog = await screen.findByRole('alertdialog');
    const before = listOrders.mock.calls.length;
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: t('admin.orders.cancelConfirm'),
      }),
    );
    expect(changeOrderStatus).toHaveBeenCalledTimes(1);
    expect(changeOrderStatus).toHaveBeenCalledWith({
      data: { orderId: 'o0001', statusId: CANCELLED.id },
    });
    await waitFor(async () =>
      expect((await select()).hasAttribute('disabled')).toBe(true),
    );
    // ціна TSDB-1: +N запитів після запису (1 живий зріз -> не більше +1).
    await awaitRevalidation(listOrders, before);
    expect(listOrders.mock.calls.length).toBeLessThanOrEqual(before + 1);
    // Ревалідація віддала стан сервера — результат запису не відкотився.
    expect((await select()).hasAttribute('disabled')).toBe(true);
  });

  it('409 state → тост orderCancelledFinal, стан колекції незмінний', async () => {
    reset([makeOrder(1, at)]);
    const { AdminConflictError } =
      await import('../../../../../admin-server/impl/errors');
    changeOrderStatus.mockRejectedValue(
      new AdminConflictError('state', 'order_cancelled_final'),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    fireEvent.change(await select(), { target: { value: DONE.id } });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.orderCancelledFinal'),
      ),
    );
    expect(((await select()) as HTMLSelectElement).value).toBe(NEW.id);
  });

  it('рядок не знайдено → «не знайдено»; поки вантажиться — не він', async () => {
    reset([]);
    params.orderId = 'nope';
    render(<OrderDetailPage />, { wrapper: wrap });
    expect(screen.queryByText(t('admin.orders.notFound'))).toBeNull();
    expect(await screen.findByText(t('admin.orders.notFound'))).toBeTruthy();
  });
});
