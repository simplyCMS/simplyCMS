import { createFileRoute } from '@tanstack/react-router';
import CartPage from '@simplycms/storefront-routes/pages/Cart';

export const Route = createFileRoute('/_storefront/cart')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Кошик — SimplyCMS Store' }],
  }),
  component: CartPage,
});
