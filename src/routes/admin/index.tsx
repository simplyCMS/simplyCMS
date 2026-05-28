import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '@simplycms/admin/pages/Dashboard';

export const Route = createFileRoute('/admin/')({
  ssr: false,
  component: Dashboard,
});
