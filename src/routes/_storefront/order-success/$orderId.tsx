import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';

export const Route = createFileRoute(
  '/_storefront/order-success/$orderId',
)({
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
