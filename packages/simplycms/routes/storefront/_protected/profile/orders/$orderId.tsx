import { createFileRoute } from '@tanstack/react-router';
import ProfileOrderDetailPage from 'simplycms/storefront-routes/pages/ProfileOrderDetail';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_protected/profile/orders/$orderId')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('checkout.success.details') })),
  component: ProfileOrderDetailPage,
});
