import { createFileRoute } from '@tanstack/react-router';
import UserCategoryRuleEdit from 'simplycms/admin/pages/UserCategoryRuleEdit';

export const Route = createFileRoute('/admin/user-categories/rules/$ruleId')({
  component: UserCategoryRuleEdit,
});
