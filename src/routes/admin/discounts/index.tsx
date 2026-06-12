import { createFileRoute } from '@tanstack/react-router';
import Discounts from '@simplysoftua/admin/pages/Discounts';

export const Route = createFileRoute('/admin/discounts/')({
  ssr: false,
  component: Discounts,
});
