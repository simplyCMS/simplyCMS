import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';

export const Route = createFileRoute('/_protected/profile/settings')({
  head: () => ({
    meta: [{ title: 'Налаштування — SimplyCMS Store' }],
  }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.ProfileSettingsPage />;
}
