// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiscountEnvironment } from 'simplycms/contracts';
import { AGGREGATE } from 'simplycms/contracts/entities';

/**
 * Середовище вітрини (Е6в-10): ключ із `userId` і `staleTime: 0`.
 *
 * 🔴 `userId` у ключі — лише сегмент клієнтського кешу: serverFn викликається
 * БЕЗ аргументів, актора сервер бере з сесії. Тест це й пінує.
 */
const server = vi.hoisted(() => ({ getDiscountEnvironment: vi.fn() }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock('../../lib/discounts', () => server);
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));

import { useDiscountEnvironment } from '../useDiscountEnvironment';

const ENV: DiscountEnvironment = {
  forest: [],
  actor: { userId: null, categoryId: 'cat-retail', isLoggedIn: false },
  priceTypeId: 'retail',
  defaultPriceTypeId: 'retail',
  now: new Date('2026-01-01T00:00:00.000Z'),
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const keys = () =>
  client
    .getQueryCache()
    .findAll({ queryKey: AGGREGATE.discountEnvironment.key })
    .map((q) => q.queryKey);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth.user = null;
  server.getDiscountEnvironment.mockReset();
  server.getDiscountEnvironment.mockResolvedValue(ENV);
});
afterEach(cleanup);

describe('useDiscountEnvironment', () => {
  it('гість — ключ [..., null]; після входу — [..., u1] і новий запит', async () => {
    const { result, rerender } = renderHook(() => useDiscountEnvironment(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(ENV));
    expect(keys()).toEqual([[...AGGREGATE.discountEnvironment.key, null]]);
    expect(server.getDiscountEnvironment).toHaveBeenCalledTimes(1);

    auth.user = { id: 'u1' };
    rerender();
    await waitFor(() =>
      expect(server.getDiscountEnvironment).toHaveBeenCalledTimes(2),
    );
    expect(keys()).toContainEqual([...AGGREGATE.discountEnvironment.key, 'u1']);
    // Актора визначає сесія на сервері — клієнт нічого не передає.
    for (const call of server.getDiscountEnvironment.mock.calls)
      expect(call).toEqual([]);
  });

  it('staleTime 0: повторний mount кличе serverFn удруге', async () => {
    const first = renderHook(() => useDiscountEnvironment(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(ENV));
    first.unmount();

    const second = renderHook(() => useDiscountEnvironment(), { wrapper });
    await waitFor(() =>
      expect(server.getDiscountEnvironment).toHaveBeenCalledTimes(2),
    );
    expect(second.result.current.data).toEqual(ENV);
  });

  it('до відповіді — data undefined і isLoading', () => {
    server.getDiscountEnvironment.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDiscountEnvironment(), { wrapper });
    expect(result.current).toEqual({ data: undefined, isLoading: true });
  });
});
