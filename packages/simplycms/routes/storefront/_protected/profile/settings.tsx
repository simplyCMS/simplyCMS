import { createFileRoute } from '@tanstack/react-router';
import ProfileSettingsPage from 'simplycms/storefront-routes/pages/ProfileSettings';

export const Route = createFileRoute('/_protected/profile/settings')({
  head: () => ({
    meta: [{ title: 'Налаштування — SimplyCMS Store' }],
  }),
  component: ProfileSettingsPage,
});
