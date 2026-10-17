import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../products/edit/__tests__/test-engine-stub';

export { mocks, ui } from './mocks';
export { stubDom } from '../../shipping/methods/__tests__/render-support';

export const REVIEW_ID = 'r0000000-0000-4000-8000-000000000001';

export const row = (n: number, over: Record<string, unknown> = {}) => ({
  id: `r0000000-0000-4000-8000-00000000000${n}`,
  productId: 'p0000000-0000-4000-8000-000000000001',
  productName: `Товар ${n}`,
  userId: `u0000000-0000-4000-8000-00000000000${n}`,
  authorName: `Автор ${n}`,
  authorEmail: `a${n}@shop.test`,
  rating: 4,
  title: `Заголовок ${n}`,
  status: 'pending',
  imagesCount: 0,
  createdAt: new Date(Date.UTC(2026, 9, 1, 10) - n * 1000),
  updatedAt: new Date(Date.UTC(2026, 9, 1, 11) - n * 1000),
  ...over,
});

export const page = (rows: unknown[], nextCursor: unknown = null) => ({
  rows,
  nextCursor,
});

export const card = (over: Record<string, unknown> = {}) => ({
  ...row(1),
  content: '<p>Чудовий товар</p>',
  adminComment: null,
  images: ['review/r1/a.jpg'],
  productPath: 'kurtka',
  sectionSlug: 'odyag',
  updatedAt: new Date(Date.UTC(2026, 9, 2)),
  ...over,
});

/** Рендер з видимим QueryClient — тести звіряють `invalidateQueries`. */
export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper }) };
}
