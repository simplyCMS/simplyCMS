import { createFileRoute } from '@tanstack/react-router';
import ReviewDetail from 'simplycms/admin/pages/ReviewDetail';

export const Route = createFileRoute('/admin/reviews/$reviewId')({
  component: ReviewDetail,
});
