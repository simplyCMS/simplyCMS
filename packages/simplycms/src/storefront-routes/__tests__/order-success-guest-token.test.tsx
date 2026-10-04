// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { TestEngineProvider } from './engine-stub';
import OrderSuccess from '../pages/OrderSuccess';

// К3-Е5-1 (Е5б-15): після зняття `?token` з URL гість не сміє отримати
// «не знайдено». URL — зовнішній стор: `navigate` справді міняє search, а
// `useSearch` перерендерює сторінку, як у браузері.
const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const url = { search: {} as Record<string, string | undefined> };
  return {
    url,
    listeners,
    user: null as null | { id: string },
    setSearch(next: Record<string, string | undefined>) {
      url.search = next;
      listeners.forEach((l) => l());
    },
    navigate: vi.fn(),
    getOrderView: vi.fn(),
  };
});

vi.mock('@tanstack/react-router', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (l: () => void) => {
    h.listeners.add(l);
    return () => h.listeners.delete(l);
  };
  return {
    useParams: () => ({ orderId: 'order-1' }),
    useSearch: () => useSyncExternalStore(subscribe, () => h.url.search),
    useNavigate: () => h.navigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});
vi.mock('../server/order-view', () => ({ getOrderView: h.getOrderView }));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: h.user }),
}));

const t = createTranslator('uk');
const order = {
  id: 'order-1',
  order_number: 'SC-0001',
  first_name: 'Іван',
  last_name: 'Іваненко',
  email: 'guest@example.com',
  phone: '+380000000000',
  delivery_method: 'pickup',
  payment_method: 'cash',
  total: 100,
  created_at: new Date('2026-10-04T10:00:00Z'),
  status: null,
  items: [],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <OrderSuccess />
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  h.navigate.mockReset();
  h.getOrderView.mockReset();
  h.user = null;
  h.url.search = { token: 'tok-1' };
  // Справжній ефект URL: функція search знімає token, як у роутері.
  h.navigate.mockImplementation(
    (o: { search: (s: Record<string, string>) => Record<string, string> }) =>
      h.setSearch(o.search(h.url.search as Record<string, string>)),
  );
  // Сервер віддає гостьове замовлення лише з токеном (політика token).
  h.getOrderView.mockImplementation(
    async ({ data }: { data: { token: string | null } }) =>
      data.token === 'tok-1' || h.user ? order : null,
  );
});
afterEach(cleanup);

const tokenCalls = () =>
  h.getOrderView.mock.calls.map(
    (c) => (c[0] as { data: { token: string | null } }).data.token,
  );

describe('OrderSuccess гостя — токен захоплюється один раз (К3-Е5-1)', () => {
  it('після зняття токена з URL замовлення лишається; запиту з token: null немає', async () => {
    renderPage();
    await screen.findByText('SC-0001');
    await waitFor(() => expect(h.url.search.token).toBeUndefined());
    await act(async () => {});
    expect(screen.getByText('SC-0001')).toBeTruthy();
    expect(screen.queryByText(t('checkout.success.notFound'))).toBeNull();
    expect(tokenCalls()).not.toContain(null);
  });

  it('інвалідація ключа замовлення — повторний запит із тим самим токеном', async () => {
    const client = renderPage();
    await screen.findByText('SC-0001');
    await waitFor(() => expect(h.url.search.token).toBeUndefined());
    const before = h.getOrderView.mock.calls.length;
    await act(() =>
      client.invalidateQueries({
        queryKey: entityKey(ENTITY.orders).detail('order-1'),
      }),
    );
    await waitFor(() =>
      expect(h.getOrderView.mock.calls.length).toBeGreaterThan(before),
    );
    expect(tokenCalls().slice(before)).toEqual(['tok-1']);
    expect(screen.queryByText(t('checkout.success.notFound'))).toBeNull();
    expect(screen.getByText('SC-0001')).toBeTruthy();
  });

  it('navigate, що знімає токен, — рівно один раз', async () => {
    renderPage();
    await screen.findByText('SC-0001');
    await waitFor(() => expect(h.url.search.token).toBeUndefined());
    await act(async () => {});
    expect(h.navigate).toHaveBeenCalledTimes(1);
  });

  it('залогінений покупець: без токена, запит із token: null, без navigate', async () => {
    h.user = { id: 'u1' };
    h.url.search = {};
    renderPage();
    await screen.findByText('SC-0001');
    expect(tokenCalls()).toEqual([null]);
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
