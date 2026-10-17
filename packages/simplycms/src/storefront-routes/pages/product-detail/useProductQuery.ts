// Запит товару картки (винесено з контейнера без зміни поведінки).

import { useQuery } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { priceViewKey, VIEWER_PRICED_META } from 'simplycms/react-query';
import { useLocale } from 'simplycms/i18n';
import { useViewerPriceKey } from 'simplycms/core/hooks/useViewerPriceKey';
import { useSeedableInitialData } from 'simplycms/core/hooks/useViewerPriceSync';
import { getProduct } from '../../server/products';
import type { ProductDetailProduct } from './types';

/**
 * Товар з усіма приєднаними даними. SSR-значення приходить `initialData` —
 * саме тому сторінка не блимає лоадером після гідрації.
 *
 * 🔴 Той самий `getProduct`, що й у лоадері роуту: предикат `is_active`,
 * форма приєднаних гілок і фільтри живуть в одному місці, а не в двох
 * схожих запитах (клієнтський колись віддавав інше, ніж серверний).
 *
 * 🔴 Ключ несе вид цін глядача (Р29): прайс у payload залежить від сесії,
 * і мову запиту (І36): текст товару залежить від мови. Запит йде за адресою
 * `(мова, шлях)`, а не за slug: без цього `enabled` був би хибним на сторінці
 * сутності, де параметра `productSlug` більше немає.
 */
export function useProductQuery(
  path: string | undefined,
  initialProduct?: ProductDetailProduct,
) {
  const view = useViewerPriceKey();
  const locale = useLocale();
  const products = entityKey(ENTITY.products, locale);
  return useQuery({
    // Ключ несе шлях з реєстру, а мова вже в сегменті 1 ключа сутності: адреса
    // унікальна лише в межах мови, тож навігація між товарами не показує попередні дані.
    queryKey: priceViewKey(products.detail(path ?? ''), view),
    meta: VIEWER_PRICED_META,
    queryFn: (): Promise<ProductDetailProduct | null> =>
      getProduct({ data: { locale, path: path as string } }),
    enabled: !!path && view !== null,
    // Дані лоадера — лише поки він рахував цього глядача (Р29, M4).
    initialData: useSeedableInitialData(initialProduct),
  });
}
