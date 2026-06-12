import { createFileRoute } from '@tanstack/react-router';
import UserCategoryEdit from '@simplysoftua/admin/pages/UserCategoryEdit';

export const Route = createFileRoute('/admin/user-categories/$categoryId')({
  ssr: false,
  component: UserCategoryEdit,
});
