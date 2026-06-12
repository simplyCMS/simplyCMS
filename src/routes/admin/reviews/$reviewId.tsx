import { createFileRoute } from '@tanstack/react-router';
import ReviewDetail from '@simplysoftua/admin/pages/ReviewDetail';

export const Route = createFileRoute('/admin/reviews/$reviewId')({
  ssr: false,
  component: ReviewDetail,
});
