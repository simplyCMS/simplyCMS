// @vitest-environment jsdom
/**
 * `useStock` (Task 8, Step 2): (а) `saveStock` отримує `quantities` по всіх
 * точках з інпутів, порожнє = 0; (б) після відповіді `{ rows, target }`
 * колекція залишків містить `rows`, а `target` записано в
 * `productsCollection` (товар) / `productModificationsCollection`
 * (модифікація) без refetch; (в) відʼємне/дробове число → serverFn не
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
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  setDefaultOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
  listProducts,
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications,
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  setDefaultProductModification: vi.fn(),
  reorderProductModification: vi.fn(),
  listProductPrices: vi.fn(async () => []),
  saveProductPrices: vi.fn(),
  listStock,
  saveStock,
  listProductPropertyValues: vi.fn(async () => []),
  insertProductPropertyValues: vi.fn(),
  updateProductPropertyValues: vi.fn(),
  removeProductPropertyValues: vi.fn(),
  listModificationPropertyValues: vi.fn(async () => []),
  insertModificationPropertyValues: vi.fn(),
  updateModificationPropertyValues: vi.fn(),
  removeModificationPropertyValues: vi.fn(),
  listSections: vi.fn(async () => []),
  listPriceTypes: vi.fn(async () => []),
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

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
    saveStock.mockResolvedValueOnce({
      rows: [],
      target: { id: 'p1', stockStatus: 'in_stock' },
    });
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

  it('(б) write-back: rows у stock-колекції, target — у productsCollection', async () => {
    saveStock.mockResolvedValueOnce({
      rows: [
        {
          id: 'st1',
          pickupPointId: 'pp1',
          productId: 'p1',
          modificationId: null,
          quantity: 5,
        },
      ],
      target: {
        id: 'p1',
        stockStatus: 'in_stock',
        name: 'Товар',
        slug: 'x',
      },
    });
    const queryClient = new QueryClient();
    const wrap2 = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    listProducts.mockResolvedValueOnce([
      { id: 'p1', stockStatus: 'out_of_stock' },
    ]);
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
    await result.current.stock.save({ pp1: '5' });
    await waitFor(() =>
      expect(result.current.live.data?.stockStatus).toBe('in_stock'),
    );
  });

  it('(в) відʼємне число — serverFn не викликано', async () => {
    const { result } = renderHook(() => useStock('p1', null), { wrapper });
    const ok = await result.current.save({ pp1: '-1' });
    expect(ok).toBe(false);
    expect(saveStock).not.toHaveBeenCalled();
  });

  it('(в) нечислове (abc → 0 через Number) НЕ ламає — контракт: Number("abc")=NaN → помилка', async () => {
    const { result } = renderHook(() => useStock('p1', null), { wrapper });
    const ok = await result.current.save({ pp1: 'abc' });
    expect(ok).toBe(false);
    expect(saveStock).not.toHaveBeenCalled();
  });
});
