// @vitest-environment jsdom
import type { ComponentType, ReactNode } from 'react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * І45: адмінка показується мовою `profiles.ui_locale`; `NULL` чи код без пакета → основна.
 * Доводимо звʼязку `beforeLoad` → контекст → вкладений `I18nProvider` → справжня шапка
 * `AdminLayout`, а не лише чисту функцію вибору мови. Мокнуто лише межі: serverFn мови,
 * роутер, сайдбар, auth і toast (їх граф до поведінки цього тесту не стосується).
 */
const ctx = vi.hoisted(() => ({ routeContext: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useRouteContext: () => ctx.routeContext,
  }),
  Outlet: () => null,
  redirect: (opts: unknown) => {
    throw opts;
  },
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock('simplycms/admin-server', () => ({
  getAdminUiLocale: vi.fn(),
  setAdminUiLocale: vi.fn(),
}));
vi.mock('simplycms/storefront-routes/server/auth', () => ({
  getUser: vi.fn(async () => ({ id: 'u' })),
  isAdmin: vi.fn(async () => true),
}));
vi.mock('simplycms/admin/layouts/AdminSidebar', () => ({
  AdminSidebar: () => null,
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('simplycms/core/components/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));
vi.mock('simplycms/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarInset: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarTrigger: () => null,
}));

import { getAdminUiLocale } from 'simplycms/admin-server';
import { Route } from '../admin';

type Opts = {
  beforeLoad: (a: {
    context: { locales: { primary: string } };
  }) => Promise<{ adminUi: string }>;
  component: ComponentType;
};
const opts = Route.options as unknown as Opts;

/** Проганяє `beforeLoad` з профілем `stored` і рендерить компонент роуту з його контекстом. */
async function renderAdmin(stored: string | null) {
  vi.mocked(getAdminUiLocale).mockResolvedValue({ uiLocale: stored });
  ctx.routeContext = await opts.beforeLoad({
    context: { locales: { primary: 'uk' } },
  });
  const Admin = opts.component;
  const view = render(
    <Suspense fallback={null}>
      <Admin />
    </Suspense>,
  );
  await screen.findByText(/Адмін-панель|Admin panel/);
  return view;
}

describe('мова адмінки з профілю (І45)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("'en' у профілі → англійська шапка і lang=en", async () => {
    const { container } = await renderAdmin('en');

    expect(screen.getByText('Admin panel')).toBeTruthy();
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('NULL → основна мова магазину (uk)', async () => {
    const { container } = await renderAdmin(null);

    expect(screen.getByText('Адмін-панель')).toBeTruthy();
    expect(container.querySelector('[lang="uk"]')).not.toBeNull();
  });

  it("код без пакета ('de') → основна мова", async () => {
    const { container } = await renderAdmin('de');

    expect(screen.getByText('Адмін-панель')).toBeTruthy();
    expect(container.querySelector('[lang="uk"]')).not.toBeNull();
  });
});
