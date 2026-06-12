import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';

export const Route = createFileRoute('/_protected/profile/orders/$orderId')({
  head: () => ({
    meta: [{ title: 'Деталі замовлення — SimplyCMS Store' }],
  }),
  component: ProfileOrderDetailPage,
});

function ProfileOrderDetailPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.ProfileOrderDetailPage />;
}
