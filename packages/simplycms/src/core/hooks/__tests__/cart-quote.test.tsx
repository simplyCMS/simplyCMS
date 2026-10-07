// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CartQuote } from 'simplycms/contracts';
import { AGGREGATE } from 'simplycms/contracts/entities';

/**
 * Квота кошика (Е6в-13, Review Focus 2): ключ містить `userId` і склад
 * кошика, `staleTime: 0`, запит — лише після гідратації кошика.
 */
const server = vi.hoisted(() => ({ quoteCart: vi.fn() }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
const cart = vi.hoisted(() => ({
  hydrated: true,
  items: [] as {
    productId: string;
    modificationId: string | null;
    name: string;
    quantity: number;
  }[],
}));

vi.mock('../../lib/cart-quote', () => server);
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('simplycms/react-query', () => ({
  useCart: () => ({ items: cart.items, hydrated: cart.hydrated }),
}));

import { useCartQuote } from '../useCartQuote';

const P = '10000002-0000-4000-8000-000000000001';
const QUOTE: CartQuote = { lines: [], subtotal: 1234 };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const keys = () =>
  client
    .getQueryCache()
    .findAll({ queryKey: AGGREGATE.cartQuote.key })
    .map((q) => q.queryKey);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth.user = null;
  cart.hydrated = true;
  cart.items = [{ productId: P, modificationId: null, name: 'A', quantity: 1 }];
  server.quoteCart.mockReset();
  server.quoteCart.mockResolvedValue(QUOTE);
});
afterEach(cleanup);

describe('useCartQuote', () => {
  it('ключ — userId і трійки позицій; serverFn отримує лише id і кількість', async () => {
    const { result } = renderHook(() => useCartQuote(), { wrapper });
    await waitFor(() => expect(result.current.quote).toEqual(QUOTE));
    expect(keys()).toEqual([
      [...AGGREGATE.cartQuote.key, null, [[P, null, 1]]],
    ]);
    expect(server.quoteCart).toHaveBeenCalledWith({
      data: { items: [{ productId: P, modificationId: null, quantity: 1 }] },
    });
  });

  it('зміна кількості — новий ключ і новий запит', async () => {
    const { result, rerender } = renderHook(() => useCartQuote(), { wrapper });
    await waitFor(() => expect(result.current.quote).toEqual(QUOTE));
    cart.items = [{ ...cart.items[0], quantity: 3 }];
    rerender();
    await waitFor(() => expect(server.quoteCart).toHaveBeenCalledTimes(2));
    expect(keys()).toContainEqual([
      ...AGGREGATE.cartQuote.key,
      null,
      [[P, null, 3]],
    ]);
  });

  it('вхід покупця — userId у ключі й перезапит', async () => {
    const { result, rerender } = renderHook(() => useCartQuote(), { wrapper });
    await waitFor(() => expect(result.current.quote).toEqual(QUOTE));
    auth.user = { id: 'u1' };
    rerender();
    await waitFor(() => expect(server.quoteCart).toHaveBeenCalledTimes(2));
    expect(keys()).toContainEqual([
      ...AGGREGATE.cartQuote.key,
      'u1',
      [[P, null, 1]],
    ]);
  });

  it('до гідратації — жодного запиту, квоти немає, стан завантаження', () => {
    cart.hydrated = false;
    const { result } = renderHook(() => useCartQuote(), { wrapper });
    expect(result.current).toEqual({ quote: null, isLoading: true });
    expect(server.quoteCart).not.toHaveBeenCalled();
  });

  it('порожній кошик — нульова квота без запиту', () => {
    cart.items = [];
    const { result } = renderHook(() => useCartQuote(), { wrapper });
    expect(result.current).toEqual({
      quote: { lines: [], subtotal: 0 },
      isLoading: false,
    });
    expect(server.quoteCart).not.toHaveBeenCalled();
  });
});
