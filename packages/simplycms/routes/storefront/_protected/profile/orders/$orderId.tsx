import { createFileRoute } from '@tanstack/react-router';
import ProfileOrderDetailPage from 'simplycms/storefront-routes/pages/ProfileOrderDetail';

export const Route = createFileRoute('/_protected/profile/orders/$orderId')({
  head: () => ({
    meta: [{ title: 'Деталі замовлення — SimplyCMS Store' }],
  }),
  component: ProfileOrderDetailPage,
});
