import { createFileRoute } from '@tanstack/react-router';
import PickupPointEdit from 'simplycms/admin/pages/PickupPointEdit';

export const Route = createFileRoute('/admin/shipping/pickup-points/$pointId')({
  component: PickupPointEdit,
});
