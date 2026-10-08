import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import CustomersPage from '../CustomersPage';

export { mocks } from './mocks';
export { stubDom } from '../../../shipping/methods/__tests__/render-support';

export const CAT = {
  id: 'a0000000-0000-4000-8000-000000000002',
  name: 'Опт',
  code: 'opt',
  description: null,
  isDefault: false,
  createdAt: new Date(),
  priceTypeId: null,
};

export const row = (n: number, over: Record<string, unknown> = {}) => ({
  userId: `u0000000-0000-4000-8000-00000000000${n}`,
  email: `buyer${n}@shop.test`,
  name: `Покупець ${n}`,
  phone: null,
  categoryId: CAT.id,
  categoryName: CAT.name,
  ordersCount: n,
  ordersTotalCents: n * 10000,
  isAdmin: false,
  bannedAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, 10) - n * 1000),
  ...over,
});

export const page = (rows: unknown[], nextCursor: unknown = null) => ({
  rows,
  nextCursor,
});

export const renderPage = () =>
  render(<CustomersPage />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <EngineProvider value={ENGINE}>
          <I18nProvider locale="uk">{children}</I18nProvider>
        </EngineProvider>
      </QueryClientProvider>
    ),
  });
