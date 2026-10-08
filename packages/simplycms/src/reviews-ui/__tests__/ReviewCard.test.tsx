// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import type { ProductReview } from 'simplycms/core/hooks/useProductReviews';

vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

import { ReviewCard } from '../ReviewCard';

afterEach(cleanup);
const t = createTranslator('uk');

const review = (over: Partial<ProductReview>): ProductReview => ({
  id: 'r1',
  product_id: 'p1',
  user_id: 'u-2',
  rating: 5,
  title: 'Добре',
  content: null,
  images: [],
  status: 'approved',
  admin_comment: null,
  created_at: new Date('2026-10-01T10:00:00Z'),
  updated_at: new Date('2026-10-01T10:00:00Z'),
  profile: null,
  ...over,
});

const renderCard = (r: ProductReview) =>
  render(
    <I18nProvider locale="uk">
      <ReviewCard review={r} />
    </I18nProvider>,
  );

describe('ReviewCard — автор видалений (Е6г)', () => {
  it('user_id null → «Колишній покупець», а не «Користувач»', () => {
    renderCard(review({ user_id: null }));
    expect(screen.getByText(t('reviews.formerCustomer'))).toBeTruthy();
    expect(screen.queryByText(t('reviews.anonymousAuthor'))).toBeNull();
  });

  it('є user_id без профілю → нинішня логіка («Користувач»)', () => {
    renderCard(review({}));
    expect(screen.getByText(t('reviews.anonymousAuthor'))).toBeTruthy();
    expect(screen.queryByText(t('reviews.formerCustomer'))).toBeNull();
  });
});
