import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ThemeProvider } from '@simplycms/themes/ThemeContext';
import { ProtectedShell } from '@simplycms/storefront-routes/shells/ProtectedShell';
import { getActiveTheme } from '@simplycms/storefront-routes/server/themes';
import { getUser } from '@simplycms/storefront-routes/server/auth';

/**
 * Layout захищених маршрутів (профіль користувача).
 *
 * `beforeLoad` виконує серверну перевірку сесії та редиректить незалогінених на `/auth`.
 * Активна тема резолвиться так само, як у storefront, а каркас профілю дає ядро
 * (`ProtectedShell`): Header/Footer теми + канонічна бічна навігація.
 */
export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const user = await getUser();
    if (!user) {
      throw redirect({ to: '/auth' });
    }
  },
  loader: async () => {
    const record = await getActiveTheme();
    return {
      themeName: record?.name ?? 'default',
      themeSettings: (record?.settings as Record<string, unknown>) ?? {},
    };
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { themeName, themeSettings } = Route.useLoaderData();

  return (
    <ThemeProvider
      fallbackTheme="default"
      initialThemeName={themeName}
      initialThemeSettings={themeSettings}
    >
      <ProtectedShell>
        <Outlet />
      </ProtectedShell>
    </ThemeProvider>
  );
}
