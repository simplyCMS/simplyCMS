// @vitest-environment jsdom
// Дашборд на серверному шарі (Task 8, Е6г): мок межі `dashboardSummary`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator } from 'simplycms/i18n';
import { dashboardSummary, listOrderStatuses, slot } from './dashboard-mocks';
import { NEW, fmt, renderPage, summary } from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(await import('./dashboard-mocks')),
);
vi.mock('simplycms/plugins/PluginSlot', async () => {
  const { slot } = await import('./dashboard-mocks');
  return {
    PluginSlot: (props: { name: string; context: unknown }) => {
      slot(props.name, props.context);
      return null;
    },
  };
});
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

const t = createTranslator('uk');

beforeEach(() => {
  slot.mockClear();
  dashboardSummary.mockReset();
  listOrderStatuses.mockResolvedValue([NEW]);
  dashboardSummary.mockResolvedValue(summary());
});
afterEach(cleanup);

describe('DashboardPage: стани', () => {
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
    renderPage(client);
    await screen.findByText('N-1');
    await client.refetchQueries();
    await waitFor(() => expect(dashboardSummary).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('N-1')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });
});
