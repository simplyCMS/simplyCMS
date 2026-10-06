// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { TestEngineProvider } from './engine-stub';
import ProfileOrderDetail from '../pages/ProfileOrderDetail';

/**
 * Кнопка «Скасувати» в кабінеті покупця є лише для статусу `new`
 * (Е5-5: код береться з контракту T0, а не з рядкового літерала).
 */
const { getMyOrderMock } = vi.hoisted(() => ({ getMyOrderMock: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'order-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../server/profile-orders', () => ({
  getMyOrder: getMyOrderMock,
  cancelMyOrder: vi.fn(),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

const t = createTranslator('uk');

const order = (code: string) => ({
  id: 'order-1',
  order_number: '0001',
  first_name: 'Іван',
  last_name: 'Іваненко',
  email: 'test@example.com',
  phone: '+380000000000',
  delivery_city: null,
  shipping_data: {},
  delivery_address: null,
  payment_method: 'cash',
  notes: null,
  subtotal: 100,
  total: 100,
  created_at: new Date(),
  status_id: 's-1',
  status: { id: 's-1', name: 'Статус', code, color: null },
  has_different_recipient: false,
  recipient_first_name: null,
  recipient_last_name: null,
  recipient_phone: null,
  recipient_email: null,
  items: [],
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <ProfileOrderDetail />
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  getMyOrderMock.mockReset();
});

describe('ProfileOrderDetail: кнопка скасування', () => {
  it('статус new — кнопка «Скасувати» є', async () => {
    getMyOrderMock.mockResolvedValue(order(ORDER_STATUS_CODE.new));
    renderPage();
    expect(
      await screen.findByRole('button', { name: t('common.cancel') }),
    ).toBeTruthy();
  });

  it('статус confirmed — кнопки немає', async () => {
    getMyOrderMock.mockResolvedValue(order('confirmed'));
    renderPage();
    await screen.findByText(t('profile.order.items'));
    expect(
      screen.queryByRole('button', { name: t('common.cancel') }),
    ).toBeNull();
  });
});
