import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadModificationIds,
  loadLocaleSet,
  loadModificationStock,
  loadProduct,
  loadProductModificationValues,
  withStorefrontDb,
  withViewerDb,
  type ModificationStockRow,
} from 'simplycms/storefront/loaders';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';

/** Характеристики й наявність модифікацій одного товару. */
export interface ModificationDataPayload {
  propertyValues: Record<string, ProductPropertyValueViewModel[]>;
  stock: Record<string, ModificationStockRow>;
}

/**
 * Отримати товар за адресою з реєстру: мова запиту + шлях без префікса мови
 * (сторінка товару). Ціни — лише видів глядача сесії; залогіненому —
 * `private, no-store` (Р29, `withViewerDb`). Мова мусить бути опублікованою,
 * інакше `null`: чернетки мови відкривати не можна навіть прямим викликом.
 */
export const getProduct = createServerFn({ method: 'GET' })
  .validator(z.object({ locale: z.string().min(1), path: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const address = input as { locale: string; path: string };
    return withViewerDb((db, viewer) => loadProduct(db, address, viewer));
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
  .validator(
    z.object({ productId: z.string().min(1), locale: z.string().min(1) }),
  )
  .handler(async ({ data: input }): Promise<ModificationDataPayload> => {
    const { productId, locale } = input as {
      productId: string;
      locale: string;
    };
    // Мова з клієнта — лише вибір тексту: невідома чи неопублікована мова
    // читається основною, а не помилкою.
    const set = await loadLocaleSet();
    const shown = set.published.includes(locale) ? locale : set.primary;

    return withStorefrontDb(async (db) => ({
      propertyValues: await loadProductModificationValues(
        db,
        productId,
        shown,
        set.primary,
      ),
      stock: await loadModificationStock(
        db,
        await loadModificationIds(db, productId),
      ),
    }));
  });
