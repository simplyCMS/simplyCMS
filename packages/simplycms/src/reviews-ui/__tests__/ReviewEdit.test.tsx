// @vitest-environment jsdom
// Редагування власного відгуку (Е6д-23): кнопка лише в автора, наявні фото,
// збереження → `pending`-бейдж, чужий відгук без правки.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  auth,
  getProductReviews,
  mountWith,
  review,
  updateProductReview,
} from './reviewsTestSupport';
import { ProductReviews } from '../ProductReviews';

const mount = () => mountWith(ProductReviews);

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
    submitProductReview: vi.fn(),
    updateProductReview: k.updateProductReview,
    deleteMyProductReview: vi.fn(),
  };
});

const withPhotos = (id: string, userId: string, status = 'approved') => ({
  ...review(id, userId, status),
  images: ['/media/a.png', '/media/b.png'],
  own_photos: [
    { ref: 'a.png', url: '/media/a.png' },
    { ref: 'b.png', url: '/media/b.png' },
  ],
});

beforeEach(() => {
  auth.user = { id: 'u-a' };
  getProductReviews.mockReset();
  updateProductReview.mockReset().mockResolvedValue({ id: 'ra' });
  URL.createObjectURL = () => 'blob:x';
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('ProductReviews — правка власного відгуку (Е6д-23)', () => {
  it('«Редагувати» є у власного відгуку, у чужого — немає', async () => {
    getProductReviews.mockResolvedValue([
      review('ra', 'u-a'),
      review('rb', 'u-b'),
    ]);
    mount();
    await screen.findByText('title-rb');
    expect(screen.getAllByRole('button', { name: 'Редагувати' })).toHaveLength(
      1,
    );
  });

  it('форма показує наявні фото й дозволяє прибрати; keep — лише лишене', async () => {
    getProductReviews.mockResolvedValue([withPhotos('ra', 'u-a')]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }));
    const kept = await screen.findByTestId('review-kept-photos');
    expect(within(kept).getAllByRole('img')).toHaveLength(2);
    fireEvent.click(within(kept).getAllByRole('button')[0]!);
    expect(within(kept).getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));
    await waitFor(() => expect(updateProductReview).toHaveBeenCalledTimes(1));
    const form = updateProductReview.mock.calls[0]![0].data as FormData;
    expect(form.get('id')).toBe('ra');
    expect(form.get('rating')).toBe('5');
    expect(form.getAll('keep')).toEqual(['b.png']);
  });

  it('після збереження відгук приходить із бейджем «на модерації»', async () => {
    getProductReviews.mockResolvedValueOnce([review('ra', 'u-a')]);
    getProductReviews.mockResolvedValue([review('ra', 'u-a', 'pending')]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }));
    expect(screen.queryByText('На модерації')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }));
    await screen.findByText('На модерації');
    // Форма закрилась, повернувся рядок «ви вже залишили відгук».
    expect(screen.queryByRole('button', { name: 'Зберегти зміни' })).toBeNull();
  });
});
