// Статуси відгуку. Масив — КАНОН у T0 (Е6д-10): CHECK у схемі, zod-вхід
// адмінки й фільтри UI беруть значення з нього, а не з окремих літералів.

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
