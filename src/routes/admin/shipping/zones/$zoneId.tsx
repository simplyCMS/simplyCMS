import { createFileRoute } from '@tanstack/react-router';
import ShippingZoneEdit from '@simplysoftua/admin/pages/ShippingZoneEdit';

export const Route = createFileRoute('/admin/shipping/zones/$zoneId')({
  ssr: false,
  component: ShippingZoneEdit,
});
