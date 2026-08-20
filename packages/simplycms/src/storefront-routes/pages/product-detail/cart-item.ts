// Складання позиції кошика (перенесено з контейнера без зміни логіки).

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
  const { price, basePrice, discountResult } = current;
  if (price === undefined) return null;

  return {
    productId: product.id,
    modificationId: hasModifications ? selectedModId : null,
    name: product.name,
    modificationName: hasModifications ? selectedMod?.name : undefined,
    price: price,
    basePrice: basePrice || null,
    discountData:
      discountResult && discountResult.totalDiscount > 0
        ? JSON.parse(
            JSON.stringify({
              appliedDiscounts: discountResult.appliedDiscounts,
              totalDiscount: discountResult.totalDiscount,
              basePrice: basePrice,
            }),
          )
        : null,
    image: image,
    sku: current.sku || undefined,
  };
}
