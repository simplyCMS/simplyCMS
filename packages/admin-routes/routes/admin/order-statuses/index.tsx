import { createFileRoute } from '@tanstack/react-router';
import OrderStatuses from '@simplycms/admin/pages/OrderStatuses';

export const Route = createFileRoute('/admin/order-statuses/')({
  component: OrderStatuses,
});
