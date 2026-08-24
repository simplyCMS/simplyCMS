import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadActivePickupPointsCount,
  loadPickupPoints,
  loadStockInfo,
  withStorefrontDb,
  type PickupPointRow,
  type StockByPointRow,
  type StockInfoRow,
} from 'simplycms/storefront/loaders';

export type { StockInfoRow, StockByPointRow, PickupPointRow };

/**
 * Наявність товару або модифікації разом із розкладкою по точках видачі.
 *
 * 🔴 Заміна двох RPC (`get_stock_info`, `get_active_pickup_points_count`),
 * яких у схемі v2 немає. Ціль ідентифікується публічним id товару чи
 * модифікації — персональних даних тут немає, тож виклик іде анонімним
 * актором `app_user`, а не від імені покупця.
 */
export const getStockInfo = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      productId: z.string().uuid().nullable().optional(),
      modificationId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }): Promise<StockInfoRow> => {
    const target = data as {
      productId?: string | null;
      modificationId?: string | null;
    };
    return withStorefrontDb((db) => loadStockInfo(db, target));
  });

/** Скільки точок видачі активні — від цього залежить форма блока наявності. */
export const getPickupPointsCount = createServerFn({ method: 'GET' }).handler(
  async (): Promise<number> =>
    withStorefrontDb((db) => loadActivePickupPointsCount(db)),
);

/** Активні точки видачі — довідник самовивозу. */
export const getActivePickupPoints = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PickupPointRow[]> =>
    withStorefrontDb((db) => loadPickupPoints(db)),
);
