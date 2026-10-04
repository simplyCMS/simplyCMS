// @vitest-environment jsdom
/**
 * Список замовлень (Task 6, Е5): справжні колекції + стаб межі serverFn
 * (`orders-server-stub` фільтрує/сортує/ліміт як сервер). Асерти — точні
 * тексти `createTranslator('uk')`, не `/./`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';

import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  listOrders,
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';

const { listOrderStatuses } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderStatuses,
  });
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params: { orderId: string };
    children: ReactNode;
  }) => <a href={to.replace('$orderId', params.orderId)}>{children}</a>,
}));

import OrdersPage from '../OrdersPage';
import { ORDERS_PAGE_SIZE, useOrdersList } from '../useOrdersList';

const t = createTranslator('uk');
const NEW = { id: 's-new', name: 'Нове', color: '#112233', sortOrder: 0 };
const DONE = { id: 's-done', name: 'Виконано', color: '#445566', sortOrder: 1 };

const wrap = (qc: QueryClient) =>
  function W({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <EngineProvider value={ENGINE}>
          <I18nProvider locale="uk">{children}</I18nProvider>
        </EngineProvider>
      </QueryClientProvider>
    );
  };

const at = (i: number) => new Date(Date.UTC(2026, 9, 1, 10, 0, 0) - i * 1000);

beforeEach(() => {
  listOrderStatuses.mockResolvedValue([NEW, DONE]);
});
afterEach(cleanup);

describe('OrdersPage', () => {
  it('рядок — посилання на картку; сума через useFormatPrice; дата й бейдж статусу', async () => {
    reset([makeOrder(1, at(0)), { ...makeOrder(2, at(1)), total: '1234.50' }]);
    const Wrapper = wrap(new QueryClient());
    render(<OrdersPage />, { wrapper: Wrapper });

    const link = await screen.findByRole('link', { name: 'N-2' });
    expect(link.getAttribute('href')).toBe('/admin/orders/o0002');
    expect(
      screen.getByText(formatPrice(1234.5, ENGINE.config).replace(/\s/g, ' ')),
    ).toBeTruthy();
    expect(screen.getAllByText('Нове')).toHaveLength(2);
    expect(screen.getByText(t('admin.orders.subtitle'))).toBeTruthy();
  });

  it('statusId = null → власний бейдж «Без статусу», не «Новий»', async () => {
    reset([{ ...makeOrder(1, at(0)), statusId: null }]);
    render(<OrdersPage />, { wrapper: wrap(new QueryClient()) });
    await screen.findByText(t('admin.orders.noStatus'));
    expect(screen.queryByText(t('common.new'))).toBeNull();
  });

  it('порожній список → «Замовлень ще немає»', async () => {
    reset([]);
    render(<OrdersPage />, { wrapper: wrap(new QueryClient()) });
    await screen.findByText(t('admin.orders.empty'));
  });

  it('«Показати ще» довантажує другу сторінку', async () => {
    const total = ORDERS_PAGE_SIZE + 10;
    reset(Array.from({ length: total }, (_, i) => makeOrder(i, at(i))));
    render(<OrdersPage />, { wrapper: wrap(new QueryClient()) });

    const more = await screen.findByRole('button', {
      name: t('admin.orders.loadMore'),
    });
    expect(screen.getAllByRole('link')).toHaveLength(ORDERS_PAGE_SIZE);
    await act(async () => more.click());
    await waitFor(() =>
      expect(screen.getAllByRole('link')).toHaveLength(total),
    );
    expect(
      screen.queryByRole('button', { name: t('admin.orders.loadMore') }),
    ).toBeNull();
  });

  it('фільтр статусу звужує: eq push-down і лише замовлення цього статусу', async () => {
    reset([
      makeOrder(1, at(0), 's-new'),
      makeOrder(2, at(1), 's-done'),
      makeOrder(3, at(2), 's-done'),
    ]);
    const { result, rerender } = renderHook(
      ({ statusId }: { statusId?: string }) => useOrdersList({ statusId }),
      {
        wrapper: wrap(new QueryClient()),
        initialProps: { statusId: undefined } as { statusId?: string },
      },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    rerender({ statusId: 's-done' });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data.map((r) => r.orderNumber).sort()).toEqual([
      'N-2',
      'N-3',
    ]);
    expect(listOrders).toHaveBeenCalledWith({
      data: {
        subset: expect.objectContaining({
          filters: [{ field: ['statusId'], operator: 'eq', value: 's-done' }],
        }),
      },
    });
  });
});
