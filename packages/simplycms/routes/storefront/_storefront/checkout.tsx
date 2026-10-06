import { createFileRoute } from '@tanstack/react-router';
import CheckoutPage from 'simplycms/storefront-routes/pages/Checkout';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_storefront/checkout')({
  ssr: false,
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('checkout.title') })),
  component: CheckoutPage,
});
