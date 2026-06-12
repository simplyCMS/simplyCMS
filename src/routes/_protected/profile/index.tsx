import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';

export const Route = createFileRoute('/_protected/profile/')({
  head: () => ({
    meta: [{ title: 'Профіль — SimplyCMS Store' }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.ProfilePage />;
}
