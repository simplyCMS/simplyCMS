// Складання позиції кошика (перенесено з контейнера).

import type { AddToCartItem } from '../../views/slots/ProductAddToCart';
import type {
  CurrentPricing,
  ProductDetailProduct,
  ProductModificationRow,
} from './types';

export interface CartItemInput {
  product: ProductDetailProduct;
  hasModifications: boolean;
  selectedModId: string;
  selectedMod: ProductModificationRow | undefined;
  current: CurrentPricing;
  /** Перше зображення галереї — прев'ю позиції в кошику. */
  image: string | undefined;
}

/**
 * Позиція для кошика: контейнер лише збирає дані, запис і toast — у слоті
 * `ProductAddToCart` (реквізит купівлі, який тема не може зламати).
 *
 * `null` — ціни немає, тож і купувати нічого.
 */
export function buildCartItem({
  product,
  hasModifications,
  selectedModId,
  selectedMod,
  current,
  image,
}: CartItemInput): AddToCartItem | null {
  const { price, oldPrice } = current;
  if (price === undefined) return null;

  // 🔴 Ціна в позиції — лише показ: суму замовлення рахує сервер. Розклад
  // знижок картки в кошик не їде — закреслена ціна та сама, що на картці.
  return {
    productId: product.id,
    modificationId: hasModifications ? selectedModId : null,
    name: product.name,
    modificationName: hasModifications ? selectedMod?.name : undefined,
    price: price,
    basePrice: oldPrice && oldPrice > price ? oldPrice : null,
    image: image,
    sku: current.sku || undefined,
  };
}
