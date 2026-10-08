// @vitest-environment jsdom
// Дашборд на серверному шарі (Task 8, Е6г): мок межі `dashboardSummary`.
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
import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { CORE_VERSION } from 'simplycms/contracts/semver';
import { ENGINE } from '../../products/edit/__tests__/test-engine-stub';

const { dashboardSummary, listOrderStatuses, slot } = vi.hoisted(() => ({
  dashboardSummary: vi.fn(),
  listOrderStatuses: vi.fn(async () => [] as unknown[]),
  slot: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ dashboardSummary, listOrderStatuses }),
);
vi.mock('simplycms/plugins/PluginSlot', () => ({
  PluginSlot: (props: { name: string; context: unknown }) => {
    slot(props.name, props.context);
    return null;
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    search,
    children,
  }: {
    to: string;
    params?: { orderId: string };
    search?: { status?: string };
    children: ReactNode;
  }) => (
    <a
      href={
        to.replace('$orderId', params?.orderId ?? '') +
        (search?.status ? `?status=${search.status}` : '')
      }
    >
      {children}
    </a>
  ),
}));

import DashboardPage from '../DashboardPage';

const t = createTranslator('uk');
const NEW = { id: 's-new', name: 'Нове', color: '#112233', sortOrder: 0 };
const at = (i: number) => new Date(Date.UTC(2026, 9, 1, 10) - i * 1000);
const recent = (i: number, over = {}) => ({
  id: `o${i}`,
  orderNumber: `N-${i}`,
  customerName: `Покупець ${i}`,
  erased: false,
  totalCents: 10000 + i,
  statusId: 's-new',
  createdAt: at(i),
  ...over,
});
const summary = (over = {}) => ({
  newOrders: 7,
  newStatusId: 's-new',
  revenue7dCents: 123450,
  revenue30dCents: 987600,
  recentOrders: Array.from({ length: 10 }, (_, i) => recent(i + 1)),
  ...over,
});
const fmt = (cents: number) =>
  formatPrice(cents / 100, ENGINE.config).replace(/\s/g, ' ');

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">
          <DashboardPage />
        </I18nProvider>
      </EngineProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  slot.mockClear();
  dashboardSummary.mockReset();
  listOrderStatuses.mockResolvedValue([NEW]);
  dashboardSummary.mockResolvedValue(summary());
});
afterEach(cleanup);

describe('DashboardPage', () => {
  it('три числа, 10 рядків, посилання на фільтр і на картку', async () => {
    renderPage();
    await screen.findByText('N-1');
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText(fmt(123450))).toBeTruthy();
    expect(screen.getByText(fmt(987600))).toBeTruthy();
    const filter = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === '/admin/orders?status=s-new');
    expect(filter).toBeTruthy();
    const body = screen.getAllByRole('row').slice(1);
    expect(body).toHaveLength(10);
    const link = screen.getByRole('link', { name: 'N-3' });
    expect(link.getAttribute('href')).toBe('/admin/orders/o3');
    expect(within(body[0]!).getByText('Нове')).toBeTruthy();
    expect(screen.getByText(CORE_VERSION)).toBeTruthy();
  });

  it('newStatusId = null → картка «Нові замовлення» без посилання', async () => {
    dashboardSummary.mockResolvedValue(summary({ newStatusId: null }));
    renderPage();
    await screen.findByText('N-1');
    expect(
      screen
        .getAllByRole('link')
        .some((a) => a.getAttribute('href')?.includes('status=')),
    ).toBe(false);
    expect(screen.getByText(t('admin.dashboard.newOrders'))).toBeTruthy();
  });

  it('стерте замовлення → «Видалений покупець», без null', async () => {
    dashboardSummary.mockResolvedValue(
      summary({
        recentOrders: [recent(1, { customerName: null, erased: true })],
      }),
    );
    const { container } = renderPage();
    await screen.findByText(t('admin.orders.erasedCustomer'));
    expect(container.textContent).not.toMatch(/null/);
  });

  it('слот stats отримує рівно три поля; widgets змонтовано', async () => {
    renderPage();
    await screen.findByText('N-1');
    const call = slot.mock.calls.find((c) => c[0] === 'admin.dashboard.stats');
    expect(call?.[1]).toEqual({
      stats: { newOrders: 7, revenue7dCents: 123450, revenue30dCents: 987600 },
    });
    expect(
      slot.mock.calls.some((c) => c[0] === 'admin.dashboard.widgets'),
    ).toBe(true);
  });

  it('поки вантажиться — «—», а не 0 і не 0,00 ₴; слотів немає', async () => {
    dashboardSummary.mockReturnValue(new Promise(() => {}));
    renderPage();
    await screen.findByText(t('admin.dashboard.newOrders'));
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText(fmt(0))).toBeNull();
    expect(slot).not.toHaveBeenCalled();
  });

  it('збій → повідомлення з «Повторити», без нулів; повтор кличе читання вдруге', async () => {
    dashboardSummary
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(summary());
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(t('admin.dashboard.loadError'));
    expect(screen.queryByText(t('admin.dashboard.newOrders'))).toBeNull();
    expect(slot).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.dashboard.retry') }),
    );
    await screen.findByText('N-1');
    expect(dashboardSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('успішне нульове зведення → справжні 0 і 0,00, а не «—»', async () => {
    dashboardSummary.mockResolvedValue(
      summary({
        newOrders: 0,
        revenue7dCents: 0,
        revenue30dCents: 0,
        recentOrders: [],
      }),
    );
    renderPage();
    await screen.findByText('0');
    expect(screen.getAllByText(fmt(0))).toHaveLength(2);
    expect(screen.queryByText('—')).toBeNull();
  });

  it('невдалий фоновий refetch не ховає вже наявні дані', async () => {
    dashboardSummary
      .mockResolvedValueOnce(summary())
      .mockRejectedValueOnce(new Error('boom'));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <EngineProvider value={ENGINE}>
          <I18nProvider locale="uk">
            <DashboardPage />
          </I18nProvider>
        </EngineProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('N-1');
    await client.refetchQueries();
    await waitFor(() => expect(dashboardSummary).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('N-1')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });
});
