import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../products/edit/__tests__/test-engine-stub';
import DashboardPage from '../DashboardPage';

export const NEW = {
  id: 's-new',
  name: 'Нове',
  color: '#112233',
  sortOrder: 0,
};
const at = (i: number) => new Date(Date.UTC(2026, 9, 1, 10) - i * 1000);
export const recent = (i: number, over = {}) => ({
  id: `o${i}`,
  orderNumber: `N-${i}`,
  customerName: `Покупець ${i}`,
  erased: false,
  totalCents: 10000 + i,
  statusId: 's-new',
  createdAt: at(i),
  ...over,
});
export const summary = (over = {}) => ({
  newOrders: 7,
  newStatusId: 's-new',
  revenue7dCents: 123450,
  revenue30dCents: 987600,
  recentOrders: Array.from({ length: 10 }, (_, i) => recent(i + 1)),
  ...over,
});
export const fmt = (cents: number) =>
  formatPrice(cents / 100, ENGINE.config).replace(/\s/g, ' ');

export const renderPage = (
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) =>
  render(
    <QueryClientProvider client={client}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">
          <DashboardPage />
        </I18nProvider>
      </EngineProvider>
    </QueryClientProvider>,
  );
