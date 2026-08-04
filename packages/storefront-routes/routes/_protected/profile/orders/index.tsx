import { createFileRoute } from '@tanstack/react-router';
import ProfileOrdersPage from '@simplycms/storefront-routes/pages/ProfileOrders';

export const Route = createFileRoute('/_protected/profile/orders/')({
  head: () => ({
    meta: [{ title: 'Мої замовлення — SimplyCMS Store' }],
  }),
  component: ProfileOrdersPage,
});
