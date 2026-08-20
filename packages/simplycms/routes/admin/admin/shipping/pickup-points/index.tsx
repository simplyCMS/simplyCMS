import { createFileRoute } from '@tanstack/react-router';
import PickupPoints from 'simplycms/admin/pages/PickupPoints';

export const Route = createFileRoute('/admin/shipping/pickup-points/')({
  component: PickupPoints,
});
