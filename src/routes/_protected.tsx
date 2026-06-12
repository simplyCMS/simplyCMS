import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { use } from 'react';
import { ThemeProvider } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';
import { getActiveTheme } from '../server/themes';
import { getUser } from '../server/auth';

/**
 * Layout захищених маршрутів (профіль користувача).
 *
 * `beforeLoad` виконує серверну перевірку сесії та редиректить незалогінених на `/auth`.
 * Активна тема резолвиться так само, як у storefront, і профіль рендериться в межах
 * `theme.ProfileLayout` (із власними Header/Footer + бічна навігація).
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
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <ThemeProvider
      fallbackTheme="default"
      initialThemeName={themeName}
      initialThemeSettings={themeSettings}
    >
      <theme.ProfileLayout>
        <Outlet />
      </theme.ProfileLayout>
    </ThemeProvider>
  );
}
