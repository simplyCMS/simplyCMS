import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@simplycms/storefront-routes/pages/Profile';

export const Route = createFileRoute('/_protected/profile/')({
  head: () => ({
    meta: [{ title: 'Профіль — SimplyCMS Store' }],
  }),
  component: ProfilePage,
});
