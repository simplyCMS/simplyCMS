import { createFileRoute } from '@tanstack/react-router';
import ShippingMethodEdit from '@simplycms/admin/pages/ShippingMethodEdit';

export const Route = createFileRoute('/admin/shipping/methods/$methodId')({
  ssr: false,
  component: ShippingMethodEdit,
});
