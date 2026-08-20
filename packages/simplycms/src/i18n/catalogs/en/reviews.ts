import type { Catalog } from '../../types';

/** Product reviews — дзеркало `uk/reviews.ts`. */
export const messages: Catalog = {
  'reviews.countOne': 'review',
  'reviews.countFew': 'reviews',
  'reviews.countMany': 'reviews',

  'reviews.alreadySubmitted': "You've already reviewed this product.",
  'reviews.writeReview': 'Write a review',
  'reviews.loginPrompt': 'Sign in to leave a review',
  'reviews.loginOrRegister': 'Sign in or create an account',
  'reviews.empty': 'No reviews yet. Be the first!',

  'reviews.anonymousAuthor': 'Anonymous',
  'reviews.pendingBadge': 'Pending review',
  'reviews.delete.confirmTitle': 'Delete this review?',
  'reviews.delete.confirmText': 'This action cannot be undone.',
  'reviews.photoAlt': 'Photo {index}',
  'reviews.enlargedPhotoAlt': 'Enlarged photo',

  'reviews.form.ratingLabel': 'Rating *',
  'reviews.form.ratingRequired': 'Please select a rating',
  'reviews.form.titleLabel': 'Title (optional)',
  'reviews.form.titlePlaceholder': 'Sum up your experience',
  'reviews.form.contentLabel': 'Your review',
  'reviews.form.contentPlaceholder': 'Write your review...',
  'reviews.form.photosLabel': 'Photos (up to 5)',
  'reviews.form.submit': 'Submit review',

  'reviews.editor.linkUrl': 'Link URL',
};
