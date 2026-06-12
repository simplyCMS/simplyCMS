import { createFileRoute } from '@tanstack/react-router';
import OrderStatuses from '@simplysoftua/admin/pages/OrderStatuses';

export const Route = createFileRoute('/admin/order-statuses/')({
  ssr: false,
  component: OrderStatuses,
});
