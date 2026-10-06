import { createFileRoute } from '@tanstack/react-router';
import ProfileOrdersPage from 'simplycms/storefront-routes/pages/ProfileOrders';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_protected/profile/orders/')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('profile.orders.title') })),
  component: ProfileOrdersPage,
});
