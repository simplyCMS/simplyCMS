import { loadGuestPriceTypes } from 'simplycms/commerce';
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
  sectionId?: string,
): Promise<ProductListPayload> {
  // Послідовно: транзакція живе на одному зʼєднанні (див. `storefront/loaders`).
  const rows = await loadProductList(db, sectionId);
  return toProductListPayload(rows, await loadGuestPriceTypes(db));
}
