import { createFileRoute } from '@tanstack/react-router';
import ShippingZones from '@simplysoftua/admin/pages/ShippingZones';

export const Route = createFileRoute('/admin/shipping/zones/')({
  ssr: false,
  component: ShippingZones,
});
