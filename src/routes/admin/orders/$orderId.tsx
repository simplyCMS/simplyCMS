import { createFileRoute } from '@tanstack/react-router';
import OrderDetail from '@simplysoftua/admin/pages/OrderDetail';

export const Route = createFileRoute('/admin/orders/$orderId')({
  ssr: false,
  component: OrderDetail,
});
