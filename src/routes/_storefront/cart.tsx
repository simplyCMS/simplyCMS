import { createFileRoute } from '@tanstack/react-router';
import { use } from 'react';
import { useTheme } from '@simplysoftua/themes/ThemeContext';
import { ThemeRegistry } from '@simplysoftua/themes/ThemeRegistry';

export const Route = createFileRoute('/_storefront/cart')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Кошик — SimplyCMS Store' }],
  }),
  component: CartPage,
});

function CartPage() {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return <theme.pages.CartPage />;
}
