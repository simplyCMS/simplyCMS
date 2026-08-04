import { createFileRoute } from '@tanstack/react-router';
import Orders from '@simplycms/admin/pages/Orders';

export const Route = createFileRoute('/admin/orders/')({
  component: Orders,
});
