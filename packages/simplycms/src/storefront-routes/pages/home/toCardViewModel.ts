// Мапінг товару головної в картку каталогу (контракт тем v3, Фаза 5).

import type { ProductCardViewModel } from 'simplycms/contracts/views';
import type { HomeProduct } from './types';

/** Ціна приходить із лоадера головної тим самим резолвом, що в каталозі (К2-Е0). */
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
    price: product.price,
    old_price: product.old_price,
  }));
}
