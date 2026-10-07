// Мапінг товару головної в картку каталогу (контракт тем v3, Фаза 5).

import type { DiscountEnvironment } from 'simplycms/contracts';
import type { ProductCardViewModel } from 'simplycms/contracts/views';
import { cardPrice } from '../pricing/priceForCard';
import type { HomeProduct } from './types';

/**
 * Ціна — тим самим `cardPrice`/`priceForCard`, що в каталозі (Е6в-11).
 *
 * До середовища (SSR і перший клієнтський рендер) картка лишається на
 * серверній базі за дефолтним типом ціни і без підказок — як сьогодні.
 * Головна без модифікацій: ціль `modification` на картці головної не діє,
 * так само як база береться з ціни товару, а не модифікації.
 */
export function toCardViewModel(
  products: HomeProduct[],
  env: DiscountEnvironment | undefined,
): ProductCardViewModel[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    images: product.images,
    short_description: product.short_description,
    section: product.section,
    stock_status: product.stock_status,
    ...(env
      ? cardPrice(product.prices, env, {
          productId: product.id,
          modificationId: null,
          sectionId: product.section_id,
        })
      : {
          price: product.price,
          old_price: product.old_price,
          discount_hints: [],
        }),
  }));
}
