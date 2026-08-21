// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { TestEngineProvider } from './engine-stub';
import OrderSuccess from '../pages/OrderSuccess';

/**
 * Task 15: guest-token не має лишатись у URL після завантаження замовлення.
 * Мокаємо useNavigate з @tanstack/react-router і перевіряємо, що після
 * успішного fetch викликається navigate({ search: <transform>, replace: true }),
 * де transform прибирає лише token, а помилка fetch navigate не викликає.
 */

const navigateMock = vi.fn();

const { mockSupabase, setSingleResult } = vi.hoisted(() => {
  let singleResult: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  };
  const builder = {
    eq: () => builder,
    single: async () => singleResult,
  };
  const mockSupabase = {
    from: () => ({ select: () => builder }),
  };
  return {
    mockSupabase,
    setSingleResult: (r: { data: unknown; error: unknown }) => {
      singleResult = r;
    },
  };
});

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'order-1' }),
  useSearch: () => ({ token: 'abc' }),
  useNavigate: () => navigateMock,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => mockSupabase,
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
  subtotal: 100,
  total: 100,
  created_at: new Date().toISOString(),
  status: null,
  items: [],
};

afterEach(() => {
  cleanup();
  navigateMock.mockClear();
});

describe('OrderSuccess — прибирання guest-token з URL', () => {
  it('після успішного завантаження замовлення викликає navigate і прибирає лише token', async () => {
    setSingleResult({ data: orderFixture, error: null });

    render(
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <OrderSuccess />
        </TestEngineProvider>
      </I18nProvider>,
    );

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

  it('при помилці завантаження navigate НЕ викликається', async () => {
    setSingleResult({ data: null, error: new Error('boom') });

    render(
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <OrderSuccess />
        </TestEngineProvider>
      </I18nProvider>,
    );

    // Чекаємо завершення fetch — компонент рендерить "не знайдено".
    await waitFor(() => expect(navigateMock).not.toHaveBeenCalled());
    // Даємо мікротаскам ще один тік, аби впевнитись, що navigate дійсно не викликано пізніше.
    await Promise.resolve();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
