import { createFileRoute } from '@tanstack/react-router';
import Products from '@simplysoftua/admin/pages/Products';

export const Route = createFileRoute('/admin/products/')({
  ssr: false,
  component: Products,
});
