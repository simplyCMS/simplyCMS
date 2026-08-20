import { createFileRoute } from '@tanstack/react-router';
import ProductEdit from 'simplycms/admin/pages/ProductEdit';

export const Route = createFileRoute('/admin/products/$productId')({
  component: ProductEdit,
});
