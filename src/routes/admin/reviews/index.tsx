import { createFileRoute } from '@tanstack/react-router';
import Reviews from '@simplysoftua/admin/pages/Reviews';

export const Route = createFileRoute('/admin/reviews/')({
  ssr: false,
  component: Reviews,
});
