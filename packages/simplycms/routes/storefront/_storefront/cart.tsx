import { createFileRoute } from '@tanstack/react-router';
import CartPage from 'simplycms/storefront-routes/pages/Cart';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_storefront/cart')({
  ssr: false,
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('cart.title') })),
  component: CartPage,
});
