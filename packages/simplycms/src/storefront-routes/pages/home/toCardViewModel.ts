// Мапінг товару головної в картку каталогу (контракт тем v3, Фаза 5).

import type { ProductCardViewModel } from 'simplycms/contracts/views';
import type { HomeProduct } from './types';

/**
 * 🔴 `HomeProduct` не несе ціни (звіт Ф1, ризик №4): скорочений SELECT
 * головної їх не тягне. `ProductCardViewModel` вимагає поля явно, тож
 * контейнер дописує `null` — картка на головній рендериться без ціни, як і
 * до спліту.
 */
export function toCardViewModel(
  products: HomeProduct[],
): ProductCardViewModel[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    images: product.images,
    short_description: product.short_description,
    section: product.section,
    stock_status: product.stock_status,
    price: null,
    old_price: null,
  }));
}
