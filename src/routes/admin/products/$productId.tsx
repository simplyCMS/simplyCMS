import { createFileRoute } from '@tanstack/react-router';
import ProductEdit from '@simplysoftua/admin/pages/ProductEdit';

export const Route = createFileRoute('/admin/products/$productId')({
  ssr: false,
  component: ProductEdit,
});
