import { createFileRoute } from '@tanstack/react-router';
import ShippingMethods from '@simplysoftua/admin/pages/ShippingMethods';

export const Route = createFileRoute('/admin/shipping/methods/')({
  ssr: false,
  component: ShippingMethods,
});
