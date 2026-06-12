import { createFileRoute } from '@tanstack/react-router';
import DiscountEdit from '@simplysoftua/admin/pages/DiscountEdit';

export const Route = createFileRoute('/admin/discounts/$discountId')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { groupId?: string } => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
  component: DiscountEdit,
});
