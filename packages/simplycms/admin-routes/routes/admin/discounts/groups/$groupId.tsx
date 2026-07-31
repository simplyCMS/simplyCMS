import { createFileRoute } from '@tanstack/react-router';
import DiscountGroupEdit from '@simplycms/admin/pages/DiscountGroupEdit';

export const Route = createFileRoute('/admin/discounts/groups/$groupId')({
  validateSearch: (search: Record<string, unknown>): { parentId?: string } => ({
    parentId: typeof search.parentId === 'string' ? search.parentId : undefined,
  }),
  component: DiscountGroupEdit,
});
