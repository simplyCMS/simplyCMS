// @vitest-environment jsdom
/**
 * `useStock` (Task 8, Step 2): (а) `saveStock` отримує `quantities` по всіх
 * точках з інпутів, порожнє = 0; (б) відповідь `{ count, stockStatus }` рядків не
 * несе — колекції лише для читання перечитуються; (в) відʼємне/дробове число → serverFn не
 * викликано.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';

const { saveStock, listStock, listProducts, listProductModifications } =
  vi.hoisted(() => ({
    saveStock: vi.fn(),
    listStock: vi.fn(async () => [] as unknown[]),
    listProducts: vi.fn(async () => [] as unknown[]),
    listProductModifications: vi.fn(async () => [] as unknown[]),
  }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProducts,
    listProductModifications,
    listStock,
    saveStockCommand: saveStock,
  }),
);

import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useStock } from '../useStock';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('useStock', () => {
  it('(а) quantities по всіх точках, порожнє = 0', async () => {
    saveStock.mockResolvedValueOnce({ count: 2, stockStatus: 'in_stock' });
    const { result } = renderHook(() => useStock('p1', null), { wrapper });

    await result.current.save({ pp1: '5', pp2: '' });

    expect(saveStock).toHaveBeenCalledWith({
      data: {
        productId: 'p1',
        modificationId: null,
        quantities: [
          { pickupPointId: 'pp1', quantity: 5 },
          { pickupPointId: 'pp2', quantity: 0 },
        ],
      },
    });
  });

  it('(б) після збереження колекції лише для читання перечитуються: статус товару оновлено без write-back', async () => {
    saveStock.mockResolvedValueOnce({ count: 1, stockStatus: 'in_stock' });
    const queryClient = new QueryClient();
    const wrap2 = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    // Сервер змінив статус, поки команда виконувалась: наступне читання бачить новий.
    listProducts
      .mockResolvedValueOnce([{ id: 'p1', stockStatus: 'out_of_stock' }])
      .mockResolvedValue([{ id: 'p1', stockStatus: 'in_stock' }]);
    // Один queryClient — один стек колекцій (WeakMap реєстру): `useStock` і
    // `useLiveQuery` нижче діляться ТІЄЮ САМОЮ productsCollection.
    const { result } = renderHook(
      () => {
        const products = useCollection(productsCollection);
        return {
          stock: useStock('p1', null),
          live: useLiveQuery((q) =>
            q
              .from({ p: products })
              .where(({ p }) => eq(p.id, 'p1'))
              .findOne(),
          ),
        };
      },
      { wrapper: wrap2 },
    );
    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    const res = await result.current.stock.save({ pp1: '5' });
    expect(res).toEqual({ stockStatus: 'in_stock' });
    await waitFor(() =>
      expect(result.current.live.data?.stockStatus).toBe('in_stock'),
    );
  });

  it('(в) відʼємне число — serverFn не викликано', async () => {
    const { result } = renderHook(() => useStock('p1', null), { wrapper });
    const res = await result.current.save({ pp1: '-1' });
    expect(res).toBeNull();
    expect(saveStock).not.toHaveBeenCalled();
  });

  it('(в) нечислове (abc → 0 через Number) НЕ ламає — контракт: Number("abc")=NaN → помилка', async () => {
    const { result } = renderHook(() => useStock('p1', null), { wrapper });
    const res = await result.current.save({ pp1: 'abc' });
    expect(res).toBeNull();
    expect(saveStock).not.toHaveBeenCalled();
  });
});
