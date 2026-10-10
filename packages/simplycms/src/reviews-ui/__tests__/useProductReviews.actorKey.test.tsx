// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import {
  auth,
  getProductReviews,
  mountWith,
  review,
} from './reviewsTestSupport';
import { ProductReviews } from '../ProductReviews';

const mount = (props: object = {}) => mountWith(ProductReviews, props);

vi.mock('simplycms/core/hooks/useAuth', async () => {
  const k = await import('./reviewsTestSupport');
  return { useAuth: () => ({ user: k.auth.user }) };
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/lib/reviews', async () => {
  const k = await import('./reviewsTestSupport');
  return { getProductReviews: k.getProductReviews, getProductRatings: vi.fn() };
});
vi.mock('simplycms/core/lib/review-form', async () => {
  const k = await import('./reviewsTestSupport');
  return {
    submitProductReview: k.submitProductReview,
    deleteMyProductReview: vi.fn(),
  };
});

beforeEach(() => {
  auth.user = null;
  getProductReviews.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('useProductReviews — ключ кешу з актором (Е6д-17)', () => {
  it('зміна користувача перезавантажує відгуки; кеш A не показується B', async () => {
    getProductReviews.mockImplementation(async () => {
      if (auth.user?.id === 'u-a') return [review('ra', 'u-a', 'pending')];
      if (auth.user?.id === 'u-b') return [review('rb', 'u-b', 'pending')];
      return [];
    });
    auth.user = null;
    const { rerenderSame } = mount();
    await waitFor(() => expect(getProductReviews).toHaveBeenCalledTimes(1));

    auth.user = { id: 'u-a' };
    rerenderSame();
    await screen.findByText('title-ra');
    expect(getProductReviews).toHaveBeenCalledTimes(2);

    auth.user = { id: 'u-b' };
    rerenderSame();
    await waitFor(() => expect(getProductReviews).toHaveBeenCalledTimes(3));
    await screen.findByText('title-rb');
    expect(getProductReviews).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('title-ra')).toBeNull();
  });
});
