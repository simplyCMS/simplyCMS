import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from 'simplycms/storefront-routes/pages/Profile';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_protected/profile/')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('profile.title') })),
  component: ProfilePage,
});
