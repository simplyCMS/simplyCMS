// @vitest-environment jsdom
/**
 * Скасування замовлення повертає резерв на склад на СЕРВЕРІ, а відповідь
 * `changeOrderStatus` рядків залишків не несе. `StockEditor` бере кількості з
 * колекції залишків і на «Зберегти» шле кількості ВСІХ пунктів — застарілий
 * зріз перезаписав би повернений резерв старим числом.
 *
 * Рівень — хуки `useStock` + `useChangeOrderStatus` на справжніх колекціях і
 * спільному QueryClient з `staleTime` 5 хв (як `src/router.tsx`): розмітка
 * діалогу тут нічого не додає, а різницю механізмів дає лише тривалість життя
 * зрізу. Зріз залишків розмонтовано довше за `gcTime` живого запиту (5 с),
 * поки колекцію тримає інша підписка, — тоді `utils.refetch()` його не бачить,
 * а `invalidateCollection` перечитує.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';

const { saveStock, changeOrderStatus, listStock, listProducts, listMods } =
  vi.hoisted(() => ({
    saveStock: vi.fn(),
    changeOrderStatus: vi.fn(),
    listStock: vi.fn(),
    listProducts: vi.fn(async () => [] as unknown[]),
    listMods: vi.fn(async () => [] as unknown[]),
  }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listStock,
    listProducts,
    listProductModifications: listMods,
    changeOrderStatus,
    saveStockCommand: saveStock,
  });
});

import {
  ordersCollection,
  stockCollection,
  useCollection,
} from 'simplycms/admin-data';
import {
  applyOutcome,
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import {
  createMutableServer,
  type Payload,
} from '../../../../../admin-data/__tests__/support/mutable-server';
import { TestI18nProvider } from '../../../../../../test-harness/i18n';
import { useStock } from '../../../products/stock/useStock';
import { useChangeOrderStatus } from '../useChangeOrderStatus';

/** Дефолтний `gcTime` живого запиту — 5 с; чекаємо з запасом. */
const LIVE_QUERY_GC_MS = 5000;

type StockRow = {
  id: string;
  productId: string;
  modificationId: string | null;
  pickupPointId: string;
  quantity: number;
};
const row = (id: string, productId: string, quantity: number): StockRow => ({
  id,
  productId,
  modificationId: null,
  pickupPointId: 'pp1',
  quantity,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('скасування замовлення → діалог залишків', () => {
  it(
    'після скасування залишки показують і надсилають серверну кількість',
    { timeout: 30_000 },
    async () => {
      const server = createMutableServer<StockRow>([
        row('s1', 'p1', 5),
        row('s2', 'other', 1),
      ]);
      listStock.mockImplementation(({ data }: { data: Payload }) =>
        server.list({ data }),
      );
      const order = makeOrder(1, new Date(Date.UTC(2026, 9, 1, 10)));
      reset([order]);
      // Сервер повертає резерв на склад: рядок залишку змінено поза відповіддю.
      changeOrderStatus.mockImplementation(async () => {
        server.upsert(row('s1', 'p1', 8));
        return applyOutcome({ order: { ...order, statusId: 's-canc' } });
      });
      saveStock.mockResolvedValue({ count: 1, stockStatus: 'in_stock' });

      const qc = new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <TestI18nProvider>{children}</TestI18nProvider>
        </QueryClientProvider>
      );

      // Підписка на ІНШИЙ зріз тримає колекцію залишків живою (як відкрита
      // картка товару): без неї колекція перечитала б усе сама.
      renderHook(
        () => {
          const stock = useCollection(stockCollection);
          return useLiveQuery((q) =>
            q.from({ s: stock }).where(({ s }) => eq(s.productId, 'other')),
          );
        },
        { wrapper },
      );
      // Скасування живе на сторінці замовлення; колекція замовлень мусить бути
      // завантажена, щоб write-back відповіді мав куди писати.
      const cancel = renderHook(
        () => {
          const orders = useCollection(ordersCollection);
          useLiveQuery((q) => q.from({ o: orders }));
          return useChangeOrderStatus();
        },
        { wrapper },
      );

      const first = renderHook(() => useStock('p1', null), { wrapper });
      await waitFor(() =>
        expect(first.result.current.rows[0]?.quantity).toBe(5),
      );
      first.unmount();
      await act(
        () => new Promise((r) => setTimeout(r, LIVE_QUERY_GC_MS + 500)),
      );

      await act(() => cancel.result.current(order.id, 's-canc'));

      const reopened = renderHook(() => useStock('p1', null), { wrapper });
      await waitFor(
        () => expect(reopened.result.current.rows[0]?.quantity).toBe(8),
        { timeout: 2000 },
      );
      // «Зберегти» діалогу шле кількості з цього зрізу.
      await act(() =>
        reopened.result.current.save({
          pp1: String(reopened.result.current.rows[0]?.quantity),
        }),
      );
      expect(saveStock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantities: [{ pickupPointId: 'pp1', quantity: 8 }],
        }),
      });
    },
  );
});
