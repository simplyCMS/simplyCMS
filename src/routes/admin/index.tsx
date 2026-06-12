import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '@simplysoftua/admin/pages/Dashboard';

export const Route = createFileRoute('/admin/')({
  ssr: false,
  component: Dashboard,
});
