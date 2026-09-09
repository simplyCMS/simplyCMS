import { createFileRoute } from '@tanstack/react-router';
import Reviews from 'simplycms/admin/pages/Reviews';

export const Route = createFileRoute('/admin/reviews/')({
  component: Reviews,
});
