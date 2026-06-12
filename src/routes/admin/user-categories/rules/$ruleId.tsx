import { createFileRoute } from '@tanstack/react-router';
import UserCategoryRuleEdit from '@simplysoftua/admin/pages/UserCategoryRuleEdit';

export const Route = createFileRoute('/admin/user-categories/rules/$ruleId')({
  ssr: false,
  component: UserCategoryRuleEdit,
});
