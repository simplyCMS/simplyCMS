import { createFileRoute, Outlet } from '@tanstack/react-router';
import { use } from 'react';
import { ThemeProvider } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';
import { getActiveTheme } from '../server/themes';

export const Route = createFileRoute('/_storefront')({
  staleTime: 5 * 60_000,
  loader: async () => {
    const record = await getActiveTheme();
    return {
      themeName: record?.name ?? 'default',
      themeSettings: (record?.settings as Record<string, unknown>) ?? {},
    };
  },
  component: StorefrontLayout,
});

function StorefrontLayout() {
  const { themeName, themeSettings } = Route.useLoaderData();
  const theme = use(ThemeRegistry.load(themeName));

  return (
    <ThemeProvider
      fallbackTheme="default"
      initialThemeName={themeName}
      initialThemeSettings={themeSettings}
    >
      <theme.MainLayout>
        <Outlet />
      </theme.MainLayout>
    </ThemeProvider>
  );
}
