import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadLocaleSet,
  loadModificationIds,
  resolveTextLocale,
  loadModificationStock,
  loadProduct,
  loadProductModificationValues,
  withStorefrontDb,
  withViewerDb,
  type ModificationStockRow,
} from 'simplycms/storefront/loaders';
import { localeInput } from 'simplycms/core/lib/locale-input';
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
  .validator(z.object({ locale: localeInput, path: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const address = input as { locale: string; path: string };
    // Основна мова — з кешу мов ДО транзакції (як `resolveTextLocale` у лістингах): галерея й
    // fallback-ознаки сторінки збираються в тому самому запиті, що й мовна версія товару.
    const { primary } = await loadLocaleSet();
    return withViewerDb((db, viewer) =>
      loadProduct(db, address, viewer, primary),
    );
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
  .validator(z.object({ productId: z.string().min(1), locale: localeInput }))
  .handler(async ({ data: input }): Promise<ModificationDataPayload> => {
    const { productId, locale } = input as {
      productId: string;
      locale: string;
    };
    // Мова з клієнта — лише вибір тексту: невідома чи неопублікована мова
    // читається основною (та сама `resolveTextLocale`, що в усіх читаннях).
    const text = await resolveTextLocale(locale);

    return withStorefrontDb(async (db) => ({
      propertyValues: await loadProductModificationValues(
        db,
        productId,
        text.locale,
        text.primary,
      ),
      stock: await loadModificationStock(
        db,
        await loadModificationIds(db, productId),
      ),
    }));
  });
