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
  // Без ціни купувати нічого — кнопка вимкнена.
  if (current.price === undefined) return null;

  // 🔴 Ціни в позиції НЕМАЄ (Е6в-13): ціну, знижку й суму кошика рахує
  // серверна квота. Запамʼятована тут ціна не оновлювалась би ні при
  // повторному додаванні, ні після зміни категорії чи акції.
  return {
    productId: product.id,
    modificationId: hasModifications ? selectedModId : null,
    name: product.name,
    modificationName: hasModifications ? selectedMod?.name : undefined,
    image: image,
    sku: current.sku || undefined,
  };
}
