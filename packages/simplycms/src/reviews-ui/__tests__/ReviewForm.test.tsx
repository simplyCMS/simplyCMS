// @vitest-environment jsdom
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
  submitProductReview,
} from './reviewsTestSupport';
import { ProductReviews } from '../ProductReviews';

const mount = (props: object = {}) => mountWith(ProductReviews, props);
import type { ReviewImageUploadProps } from '../ReviewImagePicker';

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
  auth.user = { id: 'u-a' };
  getProductReviews.mockReset().mockResolvedValue([]);
  submitProductReview.mockReset();
  URL.createObjectURL = () => 'blob:x';
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const openForm = async () => {
  fireEvent.click(await screen.findByText('Написати відгук'));
  // Зірки зведення readonly й disabled — клікабельні лише зірки групи оцінки.
  fireEvent.click(within(screen.getByRole('group')).getAllByRole('button')[0]);
};
const png = () =>
  new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });

describe('ProductReviews — форма з фото (Е6д-6)', () => {
  it('без renderImageUpload показує штатний пікер', async () => {
    mount();
    fireEvent.click(await screen.findByText('Написати відгук'));
    expect(screen.getByTestId('review-images-input')).toBeTruthy();
  });

  it('тема з власним renderImageUpload отримує рівно ReviewImageUploadProps', async () => {
    const spy = vi.fn((_p: ReviewImageUploadProps) => <i data-testid="own" />);
    mount({ renderImageUpload: spy });
    fireEvent.click(await screen.findByText('Написати відгук'));
    expect(screen.getByTestId('own')).toBeTruthy();
    const p = spy.mock.calls[0][0];
    expect(Object.keys(p).sort()).toEqual(
      ['accept', 'files', 'maxBytes', 'maxFiles', 'onFilesChange'].sort(),
    );
    expect(p.files).toEqual([]);
    expect(p.maxFiles).toBe(5);
    expect(p.maxBytes).toBe(5 * 1024 * 1024);
  });

  it('сабміт віддає FormData з полями й одним фото', async () => {
    submitProductReview.mockResolvedValue({ id: 'new' });
    mount();
    await openForm();
    fireEvent.change(screen.getByLabelText(/Заголовок/), {
      target: { value: 'Супер' },
    });
    fireEvent.change(screen.getByTestId('review-images-input'), {
      target: { files: [png()] },
    });
    fireEvent.click(screen.getByText('Надіслати відгук'));

    await waitFor(() => expect(submitProductReview).toHaveBeenCalled());
    const body = submitProductReview.mock.calls[0][0].data as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.getAll('images')).toHaveLength(1);
    expect(body.get('productId')).toBe('p1');
    expect(body.get('rating')).toBe('1');
    expect(body.get('title')).toBe('Супер');
  });

  it.each([
    ['review/already-submitted', 'Ви вже залишили відгук на цей товар.'],
    ['review/image-bad-format', 'PNG, JPEG, WebP, GIF або AVIF'],
    ['review/image-too-large', 'Фото більше 5 МБ'],
    ['review/too-many-images', 'Не більше 5 фото'],
  ])(
    'помилка %s показується перекладеною, без коду в DOM',
    async (code, text) => {
      submitProductReview.mockRejectedValue(new Error(code));
      mount();
      await openForm();
      fireEvent.click(screen.getByText('Надіслати відгук'));
      await waitFor(() => expect(document.body.textContent).toContain(text));
      expect(document.body.textContent).not.toContain('review/');
    },
  );

  it('невідомий код/довільна помилка -> загальний текст, без сирого повідомлення', async () => {
    submitProductReview.mockRejectedValue(new Error('review/some-new-code'));
    mount();
    await openForm();
    fireEvent.click(screen.getByText('Надіслати відгук'));
    await waitFor(() =>
      expect(document.body.textContent).toContain('Помилка збереження'),
    );
    expect(document.body.textContent).not.toContain('review/');
    expect(document.body.textContent).not.toContain('some-new-code');
  });
});
