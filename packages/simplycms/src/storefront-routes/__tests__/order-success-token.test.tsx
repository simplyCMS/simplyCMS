// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { TestEngineProvider } from './engine-stub';
import OrderSuccess from '../pages/OrderSuccess';

/**
 * Guest-token не має лишатись у URL після завантаження замовлення (Task 15).
 *
 * 🔴 Мокається САМА серверна функція, а не supabase-клієнт: після переходу
 * вітрини на `createServerFn` браузер у базу не ходить взагалі, тож мок
 * PostgREST-білдера тут перевіряв би неіснуючий шлях.
 */

const navigateMock = vi.fn();

const { getOrderViewMock } = vi.hoisted(() => ({
  getOrderViewMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'order-1' }),
  useSearch: () => ({ token: 'abc' }),
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../server/order-view', () => ({
  getOrderView: getOrderViewMock,
}));

vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

const orderFixture = {
  id: 'order-1',
  order_number: '0001',
  first_name: 'Іван',
  last_name: 'Іваненко',
  email: 'test@example.com',
  phone: '+380000000000',
  delivery_method: 'pickup',
  delivery_city: null,
  delivery_address: null,
  payment_method: 'cash',
  notes: null,
  subtotal: 100,
  total: 100,
  created_at: new Date().toISOString(),
  status_id: null,
  status: null,
  has_different_recipient: false,
  recipient_first_name: null,
  recipient_last_name: null,
  recipient_phone: null,
  recipient_email: null,
  items: [],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <OrderSuccess />
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  navigateMock.mockClear();
  getOrderViewMock.mockReset();
});

describe('OrderSuccess — прибирання guest-token з URL', () => {
  it('після успішного завантаження замовлення викликає navigate і прибирає лише token', async () => {
    getOrderViewMock.mockResolvedValue(orderFixture);

    renderPage();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));

    expect(navigateMock).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });

    const call = navigateMock.mock.calls[0][0] as {
      search: (s: Record<string, string>) => Record<string, string>;
    };
    expect(call.search({ token: 'abc', foo: 'x' })).toEqual({ foo: 'x' });
  });

  it('токен їде серверній функції, а не в запит із браузера', async () => {
    getOrderViewMock.mockResolvedValue(orderFixture);

    renderPage();

    await waitFor(() => expect(getOrderViewMock).toHaveBeenCalled());
    expect(getOrderViewMock).toHaveBeenCalledWith({
      data: { orderId: 'order-1', token: 'abc' },
    });
  });

  it('при помилці завантаження navigate НЕ викликається', async () => {
    getOrderViewMock.mockRejectedValue(new Error('boom'));

    renderPage();

    await waitFor(() => expect(getOrderViewMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
