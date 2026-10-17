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
  /** Версія для модерації (Е6д-23): мілісекунди, як їх повертає `isoTs`. */
  updatedAt: Date;
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
  /**
   * Поточний шлях товару в основній мові, без префікса мови (реєстр `url_paths`);
   * `null` — адреси немає (товар поза вітриною), посилання на нього не буде.
   */
  productPath: string | null;
  sectionSlug: string | null;
}
