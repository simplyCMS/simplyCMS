import { createFileRoute } from '@tanstack/react-router';
import PickupPoints from '@simplysoftua/admin/pages/PickupPoints';

export const Route = createFileRoute('/admin/shipping/pickup-points/')({
  ssr: false,
  component: PickupPoints,
});
