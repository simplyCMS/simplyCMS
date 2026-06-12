import { createFileRoute } from '@tanstack/react-router';
import UserEdit from '@simplysoftua/admin/pages/UserEdit';

export const Route = createFileRoute('/admin/users/$userId')({
  ssr: false,
  component: UserEdit,
});
