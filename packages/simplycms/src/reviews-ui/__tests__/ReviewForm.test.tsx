// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { Toaster } from 'simplycms/ui/toaster';

let currentUser: { id: string } | null = null;
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: currentUser }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const getProductReviews = vi.fn();
vi.mock('simplycms/core/lib/reviews', () => ({
  getProductReviews: (...a: unknown[]) => getProductReviews(...a),
  getProductRatings: vi.fn(),
}));
const submitProductReview = vi.fn();
vi.mock('simplycms/core/lib/review-form', () => ({
  submitProductReview: (...a: unknown[]) => submitProductReview(...a),
  deleteMyProductReview: vi.fn(),
}));

import { ProductReviews } from '../ProductReviews';
import type { ReviewImageUploadProps } from '../ReviewImagePicker';

const review = (id: string, userId: string, status = 'approved') => ({
  id,
  product_id: 'p1',
  user_id: userId,
  rating: 5,
  title: `title-${id}`,
  content: null,
  images: [],
  status,
  created_at: new Date('2026-10-01T10:00:00Z'),
  updated_at: new Date('2026-10-01T10:00:00Z'),
  profile: null,
});

const mount = (props: { renderImageUpload?: never } | object = {}) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Новий елемент на кожен рендер: `useAuth` замокано, а не контекст, тож
  // однаковий елемент React пропустив би.
  const ui = () => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <ProductReviews productId="p1" {...props} />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  );
  const r = render(ui());
  return { ...r, rerenderSame: () => r.rerender(ui()) };
};

beforeEach(() => {
  currentUser = { id: 'u-a' };
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
});

describe('useProductReviews — ключ кешу з актором (Е6д-17)', () => {
  it('зміна користувача перезавантажує відгуки; кеш A не показується B', async () => {
    getProductReviews.mockImplementation(async () => {
      if (currentUser?.id === 'u-a') return [review('ra', 'u-a', 'pending')];
      if (currentUser?.id === 'u-b') return [review('rb', 'u-b', 'pending')];
      return [];
    });
    currentUser = null;
    const { rerenderSame } = mount();
    await waitFor(() => expect(getProductReviews).toHaveBeenCalledTimes(1));

    currentUser = { id: 'u-a' };
    rerenderSame();
    await screen.findByText('title-ra');
    expect(getProductReviews).toHaveBeenCalledTimes(2);

    currentUser = { id: 'u-b' };
    rerenderSame();
    await waitFor(() => expect(getProductReviews).toHaveBeenCalledTimes(3));
    await screen.findByText('title-rb');
    expect(getProductReviews).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('title-ra')).toBeNull();
  });
});
