import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadModificationIds,
  loadModificationStock,
  loadProduct,
  loadProductModificationValues,
  withStorefrontDb,
  type ModificationStockRow,
} from 'simplycms/storefront/loaders';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';

/** Характеристики й наявність модифікацій одного товару. */
export interface ModificationDataPayload {
  propertyValues: Record<string, ProductPropertyValueViewModel[]>;
  stock: Record<string, ModificationStockRow>;
}

/** Отримати товар за slug (для сторінки товару). */
export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return withStorefrontDb((db) => loadProduct(db, slug));
  });

/**
 * Дані модифікацій товару: характеристики й залишки.
 *
 * 🔴 Вхід — `productId`, а не список id модифікацій. По-перше, список із
 * браузера довелося б звіряти; по-друге, старий клієнт робив ОКРЕМИЙ виклик
 * `rpc('get_stock_info')` на кожну модифікацію — тобто N раундтрипів там, де
 * достатньо двох запитів. Самої функції в схемі v2 вже й немає (B13).
 */
export const getModificationData = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<ModificationDataPayload> => {
    const { productId } = input as { productId: string };

    return withStorefrontDb(async (db) => ({
      propertyValues: await loadProductModificationValues(db, productId),
      stock: await loadModificationStock(
        db,
        await loadModificationIds(db, productId),
      ),
    }));
  });
