import { createFileRoute } from '@tanstack/react-router';
import Orders, { validateOrdersSearch } from 'simplycms/admin/pages/Orders';

export const Route = createFileRoute('/admin/orders/')({
  validateSearch: validateOrdersSearch,
  component: Orders,
});
