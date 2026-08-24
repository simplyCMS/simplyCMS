// Запит вибірки товарів каталогу (контракт тем v3, Фаза 4).

import { useQuery } from '@tanstack/react-query';
import type { CatalogProductRow } from 'simplycms/storefront/loaders';
import { getCatalogProducts } from '../../server/catalog';

/**
 * Вибірка товарів із модифікаціями, цінами, характеристиками й наявністю.
 *
 * `sectionId`:
 * - `undefined` — сторінка каталогу: беруться ВСІ активні товари, розділ
 *   потім фільтрується на клієнті (чипси перемикають вибірку без запиту);
 * - рядок — сторінка розділу: вибірка звужена запитом;
 * - `null` — сторінка розділу, розділ ще не приїхав: запит чекає.
 *
 * 🔴 Три колишні запити браузера (модифікації, характеристики модифікацій,
 * залишки по точках видачі) склеєні в один серверний виклик. Наявність
 * приходить готовим прапорцем `isAvailable`: складські рядки клієнту не
 * потрібні й назовні більше не їдуть.
 */
export function useCatalogProductsQuery(sectionId: string | null | undefined) {
  return useQuery({
    queryKey:
      sectionId === undefined
        ? ['all-products']
        : ['section-products', sectionId],
    queryFn: (): Promise<CatalogProductRow[]> =>
      getCatalogProducts({
        data: sectionId ? { sectionId } : {},
      }),
    enabled: sectionId !== null,
  });
}

/** Товар вибірки до резолву ціни. */
export type RawCatalogProduct = CatalogProductRow;
