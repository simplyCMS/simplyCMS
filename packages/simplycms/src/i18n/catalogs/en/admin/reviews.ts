import type { Catalog } from '../../../types';

/** Модерація відгуків — дзеркало `uk/admin/reviews.ts`. */
export const messages: Catalog = {
  'admin.reviews.subtitle': 'Moderate product reviews',
  'admin.reviews.statusFilter': 'Filter by status',
  'admin.reviews.all': 'All',
  'admin.reviews.approvedPlural': 'Approved',
  'admin.reviews.rejectedPlural': 'Rejected',
  'admin.reviews.empty': 'No reviews found',
  'admin.reviews.rating': 'Rating',
  'admin.reviews.notFound': 'Review not found',
  'admin.reviews.details': 'Review details',
  'admin.reviews.photo': 'Photo {index}',
  'admin.reviews.adminComment': 'Admin comment',
  'admin.reviews.adminCommentPlaceholder':
    'Reason for rejection or a comment...',
  'admin.reviews.approve': 'Approve',
  'admin.reviews.reject': 'Reject',
  'admin.reviews.deleteTitle': 'Delete this review?',
  'admin.reviews.deleteText':
    'The review and all of its images will be deleted permanently.',
  'admin.reviews.deleted': 'Review deleted',
  'admin.reviews.previousComment': 'Previous comment:',

  'admin.reviews.status.pending': 'Pending',
  'admin.reviews.status.approved': 'Approved',
  'admin.reviews.status.rejected': 'Rejected',
};
