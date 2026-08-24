// Запит товару картки (винесено з контейнера без зміни поведінки).

import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../server/products';
import type { ProductDetailProduct } from './types';

/**
 * Товар з усіма приєднаними даними. SSR-значення приходить `initialData` —
 * саме тому сторінка не блимає лоадером після гідрації.
 *
 * 🔴 Той самий `getProduct`, що й у лоадері роуту: предикат `is_active`,
 * форма приєднаних гілок і фільтри живуть в одному місці, а не в двох
 * схожих запитах (клієнтський колись віддавав інше, ніж серверний).
 */
export function useProductQuery(
  productSlug: string | undefined,
  initialProduct?: ProductDetailProduct,
) {
  return useQuery({
    queryKey: ['public-product', productSlug],
    queryFn: (): Promise<ProductDetailProduct | null> =>
      getProduct({ data: { slug: productSlug as string } }),
    enabled: !!productSlug,
    initialData: initialProduct,
  });
}
