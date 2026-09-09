import { createFileRoute } from '@tanstack/react-router';
import Users from 'simplycms/admin/pages/Users';

export const Route = createFileRoute('/admin/users/')({
  component: Users,
});
