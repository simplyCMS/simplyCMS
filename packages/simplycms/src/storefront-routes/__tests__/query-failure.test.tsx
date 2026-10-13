// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import { TestEngineProvider } from './engine-stub';
import Profile from '../pages/Profile';
import ProfileOrders from '../pages/ProfileOrders';
import ProfileOrderDetail from '../pages/ProfileOrderDetail';
import OrderSuccess from '../pages/OrderSuccess';

/**
 * Р26: збій запиту ≠ «порожньо» / «не знайдено». Найгірший випадок —
 * `OrderSuccess` одразу після оформлення: «замовлення не знайдено» штовхає
 * покупця оформити його вдруге.
 */
const server = vi.hoisted(() => ({
  getProfileOverview: vi.fn(),
  getMyOrders: vi.fn(),
  getOrderStatuses: vi.fn(),
  getMyOrder: vi.fn(),
  getOrderView: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'order-1' }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../server/profile', () => ({
  getProfileOverview: server.getProfileOverview,
}));
vi.mock('../server/profile-orders', () => ({
  getMyOrders: server.getMyOrders,
  getOrderStatuses: server.getOrderStatuses,
  getMyOrder: server.getMyOrder,
  cancelMyOrder: vi.fn(),
}));
vi.mock('../server/order-view', () => ({ getOrderView: server.getOrderView }));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'a@b.c' } }),
}));

const t = createTranslator('uk');

const cases = [
  {
    name: 'Profile',
    Page: Profile,
    fn: server.getProfileOverview,
    empty: { profile: null, recentOrders: [] },
    failed: 'profile.loadFailed',
    absent: 'profile.noOrders',
  },
  {
    name: 'ProfileOrders',
    Page: ProfileOrders,
    fn: server.getMyOrders,
    empty: [],
    failed: 'profile.loadFailed',
    absent: 'profile.noOrders',
  },
  {
    name: 'ProfileOrderDetail',
    Page: ProfileOrderDetail,
    fn: server.getMyOrder,
    empty: null,
    failed: 'profile.loadFailed',
    absent: 'profile.order.notFound',
  },
  {
    name: 'OrderSuccess',
    Page: OrderSuccess,
    fn: server.getOrderView,
    empty: null,
    failed: 'checkout.success.loadFailed',
    absent: 'checkout.success.notFound',
  },
] as const;

function renderPage(Page: () => React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <Page />
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  server.getOrderStatuses.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe.each(cases)('Р26: $name', ({ Page, fn, empty, failed, absent }) => {
  it('запит відхилено → стан помилки з «Повторити», без «порожньо»/«не знайдено»', async () => {
    fn.mockRejectedValue(new Error('network down'));
    renderPage(Page);

    await screen.findByText(t(failed));
    expect(screen.queryByText(t(absent))).toBeNull();

    fn.mockClear();
    fireEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    await screen.findByText(t(failed));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('повтор після збою, що вдався → показує вміст', async () => {
    fn.mockRejectedValueOnce(new Error('network down'));
    fn.mockResolvedValue(empty);
    renderPage(Page);

    await screen.findByText(t(failed));
    fireEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    await screen.findByText(t(absent));
    expect(screen.queryByText(t(failed))).toBeNull();
  });

  it('запит успішний, даних немає → справжнє «порожньо» / «не знайдено»', async () => {
    fn.mockResolvedValue(empty);
    renderPage(Page);

    await screen.findByText(t(absent));
    expect(screen.queryByText(t(failed))).toBeNull();
  });
});
