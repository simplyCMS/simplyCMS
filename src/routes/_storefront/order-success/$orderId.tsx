import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';

export const Route = createFileRoute('/_storefront/order-success/$orderId')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Замовлення оформлено — SimplyCMS Store' }],
  }),
  component: OrderSuccessPage,
});

/** Client-only сторінка без серверного loader */
function OrderSuccessPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));

  return <theme.pages.OrderSuccessPage />;
}
