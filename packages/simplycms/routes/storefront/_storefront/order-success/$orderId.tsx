import { createFileRoute } from '@tanstack/react-router';
import OrderSuccessPage from 'simplycms/storefront-routes/pages/OrderSuccess';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_storefront/order-success/$orderId')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('checkout.success.title') })),
  /** Client-only сторінка без серверного loader */
  component: OrderSuccessPage,
});
