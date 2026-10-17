import { loadGuestPriceTypes, loadViewerPriceTypes } from 'simplycms/commerce';
import type { TextLocale } from 'simplycms/domain/translations';
import { loadProductList, type ActorDb } from 'simplycms/storefront/loaders';
import {
  toProductListPayload,
  type ProductListPayload,
} from './product-list-item';

/**
 * Список товарів + контекст цін: тип ціни ГОСТЯ резолвиться в тій самій
 * транзакції тим самим правилом, що `loadPricingContext` (F5b).
 */
export async function loadProductListPayload(
  db: ActorDb,
  text: TextLocale,
  sectionId?: string,
): Promise<ProductListPayload> {
  // Послідовно: транзакція живе на одному зʼєднанні (див. `storefront/loaders`).
  // SSR-список гостьовий за побудовою (DTO несе лише гостьову `price`), тож і
  // прайс у рядках — гостьовий набір видів (Р29), незалежно від сесії.
  const rows = await loadProductList(
    db,
    await loadViewerPriceTypes(db, null),
    text,
    sectionId,
  );
  return toProductListPayload(rows, await loadGuestPriceTypes(db));
}
