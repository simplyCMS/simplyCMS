import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';

export const Route = createFileRoute('/_protected/profile/orders/')({
  head: () => ({
    meta: [{ title: 'Мої замовлення — SimplyCMS Store' }],
  }),
  component: ProfileOrdersPage,
});

function ProfileOrdersPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.ProfileOrdersPage />;
}
