// Контракти модерації відгуків для адмінки (К3-Е6д, Task 6). Лише типи.
import type { SanitizedHtml } from '../sanitized-html';
import type { ReviewStatus } from './review';

/** Рядок списку модерації: автор і email — `null` у відгуку без автора. */
export interface AdminReviewRow {
  id: string;
  productId: string;
  productName: string;
  userId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  rating: number;
  title: string | null;
  status: ReviewStatus;
  imagesCount: number;
  createdAt: Date;
}

/** Курсор keyset-пагінації `(created_at desc, id desc)`. */
export interface AdminReviewCursor {
  createdAt: Date;
  id: string;
}

export interface AdminReviewPage {
  rows: AdminReviewRow[];
  nextCursor: AdminReviewCursor | null;
}

/**
 * Картка відгуку. `images` — РЕФЕРЕНСИ (Е6д-11): адмінка резолвить їх
 * клієнтським `resolveMediaUrl`; `content` очищено на сервері.
 */
export interface AdminReviewCard extends AdminReviewRow {
  content: SanitizedHtml | null;
  adminComment: string | null;
  images: string[];
  productSlug: string;
  sectionSlug: string | null;
  updatedAt: Date;
}
