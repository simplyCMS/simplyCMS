import { createFileRoute } from '@tanstack/react-router';
import Shipping from '@simplycms/admin/pages/Shipping';

export const Route = createFileRoute('/admin/shipping/')({
  ssr: false,
  component: Shipping,
});
