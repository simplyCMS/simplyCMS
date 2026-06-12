import { createFileRoute } from '@tanstack/react-router';
import Orders from '@simplysoftua/admin/pages/Orders';

export const Route = createFileRoute('/admin/orders/')({
  ssr: false,
  component: Orders,
});
