import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplycms/themes/ThemeContext';
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';

export const Route = createFileRoute('/_storefront/checkout')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Оформлення замовлення — SimplyCMS Store' }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.CheckoutPage />;
}
