import { createFileRoute } from '@tanstack/react-router';
import CheckoutPage from '@simplycms/storefront-routes/pages/Checkout';

export const Route = createFileRoute('/_storefront/checkout')({
  ssr: false,
  head: () => ({
    meta: [{ title: 'Оформлення замовлення — SimplyCMS Store' }],
  }),
  component: CheckoutPage,
});
