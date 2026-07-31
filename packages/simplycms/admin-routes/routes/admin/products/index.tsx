import { createFileRoute } from '@tanstack/react-router';
import Products from '@simplycms/admin/pages/Products';

export const Route = createFileRoute('/admin/products/')({
  component: Products,
});
