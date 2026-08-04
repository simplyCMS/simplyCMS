import { createFileRoute } from '@tanstack/react-router';
import ShippingMethods from '@simplycms/admin/pages/ShippingMethods';

export const Route = createFileRoute('/admin/shipping/methods/')({
  component: ShippingMethods,
});
