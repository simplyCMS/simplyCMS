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
  'admin.reviews.approve': 'Approve',
  'admin.reviews.reject': 'Reject',
  'admin.reviews.deleteTitle': 'Delete this review?',
  'admin.reviews.deleteText':
    'The review and all of its images will be deleted permanently.',
  'admin.reviews.deleted': 'Review deleted',

  'admin.reviews.formerCustomer': 'Former customer',
  'admin.reviews.pending': 'Pending: {count}',
  'admin.reviews.approveSelected': 'Approve selected',
  'admin.reviews.rejectSelected': 'Reject selected',
  'admin.reviews.selectedCount': 'Selected: {count}',
  'admin.reviews.backToPending': 'Back to moderation',
  'admin.reviews.internalNote': 'Internal note — the customer does not see it',
  'admin.reviews.updated': 'Reviews updated: {count}',
  'admin.reviews.loadMore': 'Show more',
  'admin.reviews.loadError': 'Failed to load reviews',
  'admin.reviews.retry': 'Retry',
  'admin.reviews.selectAll': 'Select all loaded',
  'admin.reviews.selectRow': 'Select review',
  'admin.reviews.colAuthor': 'Author',
  'admin.reviews.colProduct': 'Product',
  'admin.reviews.colStatus': 'Status',
  'admin.reviews.colDate': 'Date',
  'admin.reviews.product': 'Product',

  'admin.reviews.status.pending': 'Pending',
  'admin.reviews.status.approved': 'Approved',
  'admin.reviews.status.rejected': 'Rejected',
};
