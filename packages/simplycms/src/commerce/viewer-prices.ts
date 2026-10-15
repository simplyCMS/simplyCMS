import { and, inArray, type SQL } from 'drizzle-orm';
import { productPrices } from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import { loadEffectiveCategoryId } from './categories';
import { groupPricesByProduct, priceColumns } from './entities/price';
import { loadGuestPriceTypes, resolvePriceTypes } from './price-types';

/**
 * Види цін, які глядач вітрини має право бачити (Р29).
 *
 * 🔴 Набір рахує СЕРВЕР і лише з ідентичності, яку дала серверна сесія:
 * клієнт, який міг би назвати свій вид чи категорію, побачив би гуртовий
 * прайс будь-якого магазину одним параметром.
 */
export interface ViewerPriceTypes {
  /** Id видів, ціни яких ідуть у payload; порожній — цін немає зовсім. */
  ids: string[];
}

/**
 * Гість — види `loadGuestPriceTypes` (тип дефолтної категорії й глобальний
 * дефолтний як відкат `resolvePrice`). Покупець — вид його ЕФЕКТИВНОЇ
 * категорії тим самим правилом, що `loadPricingContext`, плюс гостьові як
 * фолбек: JSON-LD `offers` і SSR-ціна списків рахуються гостьовими видами і
 * на сторінці залогіненого.
 *
 * 🔴 `userId` — лише з `readSessionSubject`, а транзакція — `withCustomerDb`
 * того самого id: персональну категорію RLS віддає тільки власнику профілю.
 */
export async function loadViewerPriceTypes(
  db: ActorDb,
  userId: string | null,
): Promise<ViewerPriceTypes> {
  const guest = await loadGuestPriceTypes(db);
  const own = userId
    ? await resolvePriceTypes(db, await loadEffectiveCategoryId(db, userId))
    : guest;
  const ids = [
    own.priceTypeId,
    own.defaultPriceTypeId,
    guest.priceTypeId,
    guest.defaultPriceTypeId,
  ].filter((id): id is string => id !== null);
  return { ids: [...new Set(ids)] };
}

/**
 * Предикат «ціна видима глядачу» для лоадерів, що читають `product_prices`
 * самі. Фільтр у SQL, а не після вибірки: чужий вид цін не доходить навіть
 * до памʼяті процесу, тож його не віддасть і забута гілка серіалізації.
 * Порожній набір drizzle перетворює на `false` — цін немає, а не «всі».
 */
export function visibleToViewer(viewer: ViewerPriceTypes): SQL {
  return inArray(productPrices.priceTypeId, viewer.ids);
}

/** Видимі глядачу ціни кількох товарів одним запитом (головна, розділи). */
export async function loadViewerPricesByProduct(
  db: ActorDb,
  productIds: string[],
  viewer: ViewerPriceTypes,
): Promise<Record<string, PriceEntry[]>> {
  if (productIds.length === 0) return {};
  const rows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(
      and(
        inArray(productPrices.productId, productIds),
        visibleToViewer(viewer),
      ),
    );
  return groupPricesByProduct(rows);
}
