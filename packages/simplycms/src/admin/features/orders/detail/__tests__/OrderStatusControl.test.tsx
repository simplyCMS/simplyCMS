// @vitest-environment jsdom
// Е5б Task 8 (F): поки зміна статусу в польоті, повторне підтвердження (чи
// інший вибір у select) не шле другого запиту. Справжні колекції + стаб
// межі serverFn, як у `OrderDetailPage.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  applyOutcome,
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { NEW, CANCELLED, DONE } from './support';

const { listOrderStatuses, changeOrderStatus } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  changeOrderStatus: vi.fn(),
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
    listOrderStatuses,
    changeOrderStatus,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
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
const select = () =>
  screen.findByRole('combobox', { name: t('admin.orders.statusSection') });
const confirmCancel = async () => {
  fireEvent.change(await select(), { target: { value: CANCELLED.id } });
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: t('admin.orders.cancelConfirm'),
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  listOrderStatuses.mockResolvedValue([NEW, DONE, CANCELLED]);
});
afterEach(cleanup);

describe('OrderStatusControl — запит у польоті', () => {
  it('повторне підтвердження й інший вибір поки запит летить — без другого виклику; після відповіді — знову можна', async () => {
    const order = makeOrder(1, new Date(Date.UTC(2026, 9, 1, 10)));
    reset([order]);
    let resolve!: (v: unknown) => void;
    changeOrderStatus.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    await confirmCancel();
    expect(changeOrderStatus).toHaveBeenCalledTimes(1);

    await confirmCancel();
    fireEvent.change(await select(), { target: { value: DONE.id } });
    expect(changeOrderStatus).toHaveBeenCalledTimes(1);

    // Сервер відмовив у скасуванні й лишив «Виконано» — запит завершено.
    await act(async () => {
      resolve(applyOutcome({ order: { ...order, statusId: DONE.id } }));
    });
    changeOrderStatus.mockImplementationOnce(async () =>
      applyOutcome({ order: { ...order, statusId: NEW.id } }),
    );
    fireEvent.change(await select(), { target: { value: NEW.id } });
    expect(changeOrderStatus).toHaveBeenCalledTimes(2);
  });
});
