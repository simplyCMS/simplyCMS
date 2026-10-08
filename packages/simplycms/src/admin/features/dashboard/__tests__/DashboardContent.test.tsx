// @vitest-environment jsdom
// Дашборд на серверному шарі (Task 8, Е6г): мок межі `dashboardSummary`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTranslator } from 'simplycms/i18n';
import { CORE_VERSION } from 'simplycms/contracts/semver';
import { dashboardSummary, listOrderStatuses, slot } from './dashboard-mocks';
import { NEW, fmt, recent, renderPage, summary } from './render-support';

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

describe('DashboardPage: вміст', () => {
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
});
