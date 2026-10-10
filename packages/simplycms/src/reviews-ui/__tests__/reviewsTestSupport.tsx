import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { Toaster } from 'simplycms/ui/toaster';
import type { ProductReviews } from '../ProductReviews';

/** Спільні моки тестів вітринного відгуку (`vi.mock` у файлах тестів). */
export const auth: { user: { id: string } | null } = { user: null };
export const getProductReviews = vi.fn();
export const submitProductReview = vi.fn();

export const review = (id: string, userId: string, status = 'approved') => ({
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

// Компонент передає тест: імпорт `ProductReviews` тут зациклив би фабрики
// `vi.mock`, які самі імпортують цей файл.
export const mountWith = (
  Component: typeof ProductReviews,
  props: object = {},
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Новий елемент на кожен рендер: `useAuth` замокано, а не контекст, тож
  // однаковий елемент React пропустив би.
  const ui = () => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <Component productId="p1" {...props} />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  );
  const r = render(ui());
  return { ...r, rerenderSame: () => r.rerender(ui()) };
};
