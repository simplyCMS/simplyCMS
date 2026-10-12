// @vitest-environment jsdom
/** Бейдж «очікують» у сайдбарі (Task 9, Е6д): >0 — число, 0 — без бейджа. */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { SidebarProvider } from 'simplycms/ui/sidebar';
import { AdminSidebar } from '../AdminSidebar';

const pending = vi.hoisted(() => vi.fn());
vi.mock('simplycms/admin-server', () => ({ countPendingReviews: pending }));
vi.mock('simplycms/core/components/NavLink', () => ({
  NavLink: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('simplycms/plugins/PluginSlot', () => ({ PluginSlot: () => null }));

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(cleanup);

const renderSidebar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">
        <SidebarProvider>
          <AdminSidebar />
        </SidebarProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

describe('AdminSidebar: бейдж відгуків', () => {
  it('pending: 3 → бейдж «3»', async () => {
    pending.mockResolvedValue({ pending: 3 });
    renderSidebar();
    expect(await screen.findByText('3')).toBeTruthy();
  });

  it('pending: 0 → бейджа немає', async () => {
    pending.mockResolvedValue({ pending: 0 });
    const { container } = renderSidebar();
    await vi.waitFor(() => expect(pending).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
  });
});
