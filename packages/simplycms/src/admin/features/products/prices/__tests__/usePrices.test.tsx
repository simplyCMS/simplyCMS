// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде на
// document is not defined; патерн — як у сусідніх hook-тестах Task 6/7.)
/**
 * `usePrices` (Task 8, Step 1): (а) Review Focus 4 — вхід `{ price: '1
 * 234,50', oldPrice: '' }` → `saveProductPrices` отримує рядок з
 * `price: '1234.50'`, `oldPrice: null` (порожнє поле в набір не йде);
 * (б) `'-5'` → повертає id типу з невалідним полем, serverFn не викликано;
 * (в) після відповіді `{ rows, removedIds }` колекція містить `rows` і не
 * містить `removedIds` (write-back без refetch).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// 🔴 vi.hoisted, не звичайний const (admin-data барелем тягне ВСІ файли
// колекцій — кожен імпортує щось із `simplycms/admin-server`).
const { saveProductPrices, listProductPrices, listPriceTypes } = vi.hoisted(
  () => ({
    saveProductPrices: vi.fn(),
    listProductPrices: vi.fn(async () => [] as unknown[]),
    listPriceTypes: vi.fn(async () => [] as unknown[]),
  }),
);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProductPrices,
    saveProductPrices,
    listPriceTypes,
  }),
);

import { usePrices } from '../usePrices';

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

describe('usePrices', () => {
  it('(а) кома й порожнє поле — нормалізація перед відправкою', async () => {
    saveProductPrices.mockResolvedValueOnce({ rows: [], removedIds: [] });
    const { result } = renderHook(() => usePrices('p1', null), { wrapper });

    const failed = await result.current.save({
      retail: { price: '1 234,50', oldPrice: '' },
    });

    expect(failed).toBeNull();
    expect(saveProductPrices).toHaveBeenCalledWith({
      data: {
        productId: 'p1',
        modificationId: null,
        prices: [{ priceTypeId: 'retail', price: '1234.50', oldPrice: null }],
      },
    });
  });

  it('(б) відʼємна ціна — помилка поля ДО мережі', async () => {
    const { result } = renderHook(() => usePrices('p1', null), { wrapper });

    const failed = await result.current.save({
      retail: { price: '-5', oldPrice: '' },
    });

    expect(failed).toBe('retail');
    expect(saveProductPrices).not.toHaveBeenCalled();
  });

  it('(в) write-back: rows у колекції, removedIds — ні (без refetch)', async () => {
    listProductPrices.mockResolvedValueOnce([
      {
        id: 'kept',
        productId: 'p1',
        modificationId: null,
        priceTypeId: 'wholesale',
        price: '5.00',
        oldPrice: null,
      },
      {
        id: 'gone',
        productId: 'p1',
        modificationId: null,
        priceTypeId: 'retail',
        price: '10.00',
        oldPrice: null,
      },
    ]);
    saveProductPrices.mockResolvedValueOnce({
      rows: [
        {
          id: 'kept',
          productId: 'p1',
          modificationId: null,
          priceTypeId: 'wholesale',
          price: '7.00',
          oldPrice: null,
        },
      ],
      removedIds: ['gone'],
    });

    const { result } = renderHook(() => usePrices('p1', null), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    await result.current.save({
      wholesale: { price: '7.00', oldPrice: '' },
    });

    await waitFor(() => {
      const ids = result.current.rows.map((r) => r.id);
      expect(ids).toContain('kept');
      expect(ids).not.toContain('gone');
    });
  });
});
