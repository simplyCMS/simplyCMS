// Статуси відгуку. Масив — КАНОН у T0 (Е6д-10): CHECK у схемі, zod-вхід
// адмінки й фільтри UI беруть значення з нього, а не з окремих літералів.

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Коди відмов подачі відгуку (КАНОН Е6д-10). Сервер кидає їх `message`-ем,
 * клієнт мапить у рядки каталогу: текст належить i18n, а не серверу.
 */
export const REVIEW_SUBMIT_ERROR = {
  badImage: 'review/image-bad-format',
  imageTooLarge: 'review/image-too-large',
  tooManyImages: 'review/too-many-images',
  alreadySubmitted: 'review/already-submitted',
} as const;

export type ReviewSubmitError =
  (typeof REVIEW_SUBMIT_ERROR)[keyof typeof REVIEW_SUBMIT_ERROR];
