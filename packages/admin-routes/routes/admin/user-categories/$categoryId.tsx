import { createFileRoute } from '@tanstack/react-router';
import UserCategoryEdit from '@simplycms/admin/pages/UserCategoryEdit';

export const Route = createFileRoute('/admin/user-categories/$categoryId')({
  component: UserCategoryEdit,
});
