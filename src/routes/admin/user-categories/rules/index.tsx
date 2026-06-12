import { createFileRoute } from '@tanstack/react-router';
import UserCategoryRules from '@simplysoftua/admin/pages/UserCategoryRules';

export const Route = createFileRoute('/admin/user-categories/rules/')({
  ssr: false,
  component: UserCategoryRules,
});
