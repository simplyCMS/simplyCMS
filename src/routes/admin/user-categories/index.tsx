import { createFileRoute } from '@tanstack/react-router';
import UserCategories from '@simplysoftua/admin/pages/UserCategories';

export const Route = createFileRoute('/admin/user-categories/')({
  ssr: false,
  component: UserCategories,
});
