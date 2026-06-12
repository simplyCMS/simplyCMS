import { createFileRoute } from '@tanstack/react-router';
import Shipping from '@simplysoftua/admin/pages/Shipping';

export const Route = createFileRoute('/admin/shipping/')({
  ssr: false,
  component: Shipping,
});
