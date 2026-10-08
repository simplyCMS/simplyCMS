// @vitest-environment jsdom
/**
 * Фільтр замовлень живе в URL (Task 8, Е6г-5): `OrdersPage` читає статус з
 * search і пише його через `navigate`; невалідне значення відсікає
 * `validateOrdersSearch` (його і підключає роут).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import { stubDom } from '../../../shipping/methods/__tests__/render-support';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';

const { listOrderStatuses, navigate, search } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(async () => [] as unknown[]),
  navigate: vi.fn(),
  search: { current: {} as { status?: string } },
}));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listOrders: stub.listOrders, listOrderStatuses });
});
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search.current,
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrdersPage from '../OrdersPage';
import { validateOrdersSearch } from '../orders-search';

const t = createTranslator('uk');
const NEW = { id: 's-new', name: 'Нове', color: '#112233', sortOrder: 0 };
const DONE = { id: 's-done', name: 'Виконано', color: '#445566', sortOrder: 1 };
const at = (i: number) => new Date(Date.UTC(2026, 9, 1, 10, 0, 0) - i * 1000);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">
          <OrdersPage />
        </I18nProvider>
      </EngineProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  stubDom();
  navigate.mockClear();
  search.current = {};
  listOrderStatuses.mockResolvedValue([NEW, DONE]);
  reset([
    makeOrder(1, at(0), 's-new'),
    makeOrder(2, at(1), 's-done'),
    makeOrder(3, at(2), 's-done'),
  ]);
});
afterEach(cleanup);

describe('OrdersPage: фільтр у URL', () => {
  it('?status=<id> фільтрує список', async () => {
    search.current = { status: 's-done' };
    renderPage();
    await screen.findByText('N-2');
    await waitFor(() => expect(screen.queryByText('N-1')).toBeNull());
    expect(screen.getByText('N-3')).toBeTruthy();
  });

  it('вибір статусу пише його в URL, «усі» — прибирає', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('N-1');
    await user.click(screen.getByLabelText(t('admin.orders.filters.status')));
    await user.click(await screen.findByRole('option', { name: 'Виконано' }));
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { status: 's-done' } }),
    );
    search.current = { status: 's-done' };
    cleanup();
    renderPage();
    await user.click(screen.getByLabelText(t('admin.orders.filters.status')));
    await user.click(
      await screen.findByRole('option', {
        name: t('admin.orders.filters.all'),
      }),
    );
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { status: undefined } }),
    );
  });
});

describe('validateOrdersSearch', () => {
  const ID = '0b0f6f2e-3c7a-4d0e-9a52-6f8d1c2b3a4e';
  it('uuid проходить, сміття й нерядки → відсутнє', () => {
    expect(validateOrdersSearch({ status: ID })).toEqual({ status: ID });
    expect(validateOrdersSearch({ status: 'abc' })).toEqual({
      status: undefined,
    });
    expect(validateOrdersSearch({ status: 5 })).toEqual({ status: undefined });
    expect(validateOrdersSearch({})).toEqual({ status: undefined });
  });
});
