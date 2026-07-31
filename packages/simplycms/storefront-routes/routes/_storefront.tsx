import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from '@simplycms/themes/ThemeContext';
import { StorefrontShell } from '@simplycms/storefront-routes/shells/StorefrontShell';
import { getActiveTheme } from '@simplycms/storefront-routes/server/themes';

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

  return (
    <ThemeProvider
      fallbackTheme="default"
      initialThemeName={themeName}
      initialThemeSettings={themeSettings}
    >
      <StorefrontShell>
        <Outlet />
      </StorefrontShell>
    </ThemeProvider>
  );
}
