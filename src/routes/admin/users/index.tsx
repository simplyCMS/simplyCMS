import { createFileRoute } from '@tanstack/react-router';
import Users from '@simplysoftua/admin/pages/Users';

export const Route = createFileRoute('/admin/users/')({
  ssr: false,
  component: Users,
});
