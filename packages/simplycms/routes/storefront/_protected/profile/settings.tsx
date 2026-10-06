import { createFileRoute } from '@tanstack/react-router';
import ProfileSettingsPage from 'simplycms/storefront-routes/pages/ProfileSettings';
import { storefrontHead } from 'simplycms/storefront-routes/head/head';

export const Route = createFileRoute('/_protected/profile/settings')({
  head: ({ matches }) =>
    storefrontHead(matches, (t) => ({ title: t('nav.settings') })),
  component: ProfileSettingsPage,
});
