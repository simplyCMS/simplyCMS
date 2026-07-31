import { createFileRoute } from '@tanstack/react-router';
import UserCategoryRules from '@simplycms/admin/pages/UserCategoryRules';

export const Route = createFileRoute('/admin/user-categories/rules/')({
  component: UserCategoryRules,
});
