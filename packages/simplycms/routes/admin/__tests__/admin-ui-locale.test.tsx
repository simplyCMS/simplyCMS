// @vitest-environment jsdom
import type { ComponentType, ReactNode } from 'react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  setAdminUiLocale: vi.fn(),
}));
// Мова адмінки приходить разом із сесією одним викликом (§19.6).
vi.mock('simplycms/storefront-routes/server/auth', () => ({
  getAdminSession: vi.fn(),
}));
// Тестовий реєстр: `de` — пакет без частини `admin` (§19.15).
vi.mock('../../../src/i18n/packs/registry', async (importOriginal) => {
  const { testPackRegistry } =
    await import('../../../test-harness/language-packs');
  const real =
    await importOriginal<typeof import('../../../src/i18n/packs/registry')>();
  return { PACKS: testPackRegistry(real.PACKS) };
});
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

import { getAdminSession } from 'simplycms/storefront-routes/server/auth';
import { Route } from '../admin';

type Opts = {
  beforeLoad: (a: {
    context: { locales: { primary: string } };
  }) => Promise<{ adminUi: string }>;
  component: ComponentType;
};
const opts = Route.options as unknown as Opts;

/** Проганяє `beforeLoad` з профілем `stored` і рендерить компонент роуту з його контекстом. */
async function renderAdmin(stored: string | null, primary = 'uk') {
  vi.mocked(getAdminSession).mockResolvedValue({
    isAdmin: true,
    uiLocale: stored,
  });
  ctx.routeContext = await opts.beforeLoad({
    context: { locales: { primary } },
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

  it("код без пакета ('fr') → основна мова", async () => {
    const { container } = await renderAdmin('fr');

    expect(screen.getByText('Адмін-панель')).toBeTruthy();
    expect(container.querySelector('[lang="uk"]')).not.toBeNull();
  });

  it("пакет без частини admin ('de') → основна мова, а не помилка (§19.15)", async () => {
    const { container } = await renderAdmin('de');

    expect(screen.getByText('Адмін-панель')).toBeTruthy();
    expect(container.querySelector('[lang="uk"]')).not.toBeNull();
  });

  it("основна мова з пакетом без admin ('de') і порожній профіль → en", async () => {
    const { container } = await renderAdmin(null, 'de');

    expect(screen.getByText('Admin panel')).toBeTruthy();
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
  });

  it('селектор мови показує лише пакети з admin: Deutsch (без admin) немає', async () => {
    await renderAdmin('en');

    await userEvent.click(
      screen.getByRole('button', {
        name: /Interface language|Мова інтерфейсу/,
      }),
    );

    expect(await screen.findByText('Українська')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.queryByText('Deutsch')).toBeNull();
  });

  it('без сесії → редирект на /auth, не-адмін → на /', async () => {
    vi.mocked(getAdminSession).mockResolvedValueOnce(null);
    await expect(
      opts.beforeLoad({ context: { locales: { primary: 'uk' } } }),
    ).rejects.toMatchObject({ to: '/auth' });
    vi.mocked(getAdminSession).mockResolvedValueOnce({
      isAdmin: false,
      uiLocale: null,
    });
    await expect(
      opts.beforeLoad({ context: { locales: { primary: 'uk' } } }),
    ).rejects.toMatchObject({ to: '/' });
  });
});
