// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { TestEngineProvider } from './engine-stub';
import OrderSuccess from '../pages/OrderSuccess';
import ProfileOrderDetail from '../pages/ProfileOrderDetail';

/**
 * Е6а-8, Review Focus 4: замовлення показує назву й адресу точки НА МОМЕНТ
 * оформлення. Точку потім перейменували («Інша») — читач бере знімок, а не
 * живу таблицю, тож у фікстурі немає нічого, крім `shipping_data`.
 */
const { getOrderViewMock, getMyOrderMock } = vi.hoisted(() => ({
  getOrderViewMock: vi.fn(),
  getMyOrderMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'order-1' }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../server/order-view', () => ({ getOrderView: getOrderViewMock }));
vi.mock('../server/profile-orders', () => ({
  getMyOrder: getMyOrderMock,
  cancelMyOrder: vi.fn(),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

const pickupSnapshot = {
  methodName: 'Самовивіз зі складу',
  provider: 'core:pickup',
  pricing: 'rates',
  destination: {
    kind: 'pickup-point',
    pointId: 'p-1',
    name: 'Склад у Києві',
    address: 'вул. Складська, 1',
    city: 'Київ',
  },
};
const carrierSnapshot = {
  methodName: 'Нова Пошта',
  provider: 'core:address',
  pricing: 'carrier',
  destination: { kind: 'address', city: 'Львів', address: 'вул. Шевченка, 5' },
};

const order = (shipping_data: unknown) => ({
  id: 'order-1',
  order_number: '0001',
  first_name: 'Іван',
  last_name: 'Іваненко',
  email: 'test@example.com',
  phone: '+380000000000',
  delivery_city: null,
  delivery_address: null,
  shipping_data,
  payment_method: 'cash',
  notes: null,
  subtotal: 100,
  total: 100,
  created_at: new Date(),
  status_id: null,
  status: null,
  has_different_recipient: false,
  recipient_first_name: null,
  recipient_last_name: null,
  recipient_phone: null,
  recipient_email: null,
  items: [],
});

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>{page}</TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  getOrderViewMock.mockReset();
  getMyOrderMock.mockReset();
});

const readers = [
  ['OrderSuccess', <OrderSuccess key="s" />, getOrderViewMock],
  ['ProfileOrderDetail', <ProfileOrderDetail key="p" />, getMyOrderMock],
] as const;

describe.each(readers)('%s — знімок доставки', (_name, page, mock) => {
  it('показує назву й адресу точки зі знімка', async () => {
    mock.mockResolvedValue(order(pickupSnapshot));
    renderPage(page);
    expect(await screen.findByText(/Склад у Києві/)).toBeTruthy();
    expect(screen.getByText(/вул\. Складська, 1/)).toBeTruthy();
    expect(screen.getByText(/Самовивіз зі складу/)).toBeTruthy();
  });

  it('carrier: примітка про тарифи перевізника', async () => {
    mock.mockResolvedValue(order(carrierSnapshot));
    renderPage(page);
    expect(await screen.findByText(/Нова Пошта/)).toBeTruthy();
    expect(
      screen.getByText('за тарифами перевізника (оплата при отриманні)'),
    ).toBeTruthy();
    expect(screen.getByText(/вул\. Шевченка, 5/)).toBeTruthy();
  });

  it('порожній знімок не валить сторінку', async () => {
    mock.mockResolvedValue(order({}));
    renderPage(page);
    expect(await screen.findByText('Іван Іваненко')).toBeTruthy();
  });
});
