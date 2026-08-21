import { createFileRoute } from '@tanstack/react-router';
import OrderSuccessPage from 'simplycms/storefront-routes/pages/OrderSuccess';

export const Route = createFileRoute('/_storefront/order-success/$orderId')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Замовлення оформлено — SimplyCMS Store' }],
  }),
  /** Client-only сторінка без серверного loader */
  component: OrderSuccessPage,
});
