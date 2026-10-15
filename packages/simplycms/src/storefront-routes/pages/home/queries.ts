import { useQuery } from '@tanstack/react-query';
import {
  catalogKeys,
  priceViewKey,
  VIEWER_PRICED_META,
} from 'simplycms/react-query';
import { useViewerPriceKey } from 'simplycms/core/hooks/useViewerPriceKey';
import { useSeedableInitialData } from 'simplycms/core/hooks/useViewerPriceSync';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import {
  getFeaturedProducts,
  getNewProducts,
  getRootSections,
  getSectionProducts,
} from '../../server/home';
import type { HomeProduct, HomeSection } from './types';

const products = entityKey(ENTITY.products);
const sections = entityKey(ENTITY.sections);

/**
 * Запити головної.
 *
 * 🔴 Усі чотири ходять через `createServerFn`, а не в БД із браузера: на
 * чистому Postgres PostgREST не існує, тож будь-який запит клієнтом БД
 * після гідрації просто нікуди не потрапляє. Форма даних збережена
 * дослівно — сторінка й картки не переписувались.
 *
 * 🔴 Запити з прайсом карток несуть вид цін глядача сегментом 1 (Р29,
 * `priceViewKey`) і мітку `VIEWER_PRICED_META` — їх скидає вхід і вихід.
 */

/** Популярні товари (`is_featured`) — канонічна добірка головної */
export function useFeaturedProducts(initialData?: HomeProduct[]) {
  const view = useViewerPriceKey();
  return useQuery({
    queryKey: priceViewKey(products.variant('featured'), view),
    meta: VIEWER_PRICED_META,
    enabled: view !== null,
    queryFn: (): Promise<HomeProduct[]> => getFeaturedProducts(),
    initialData: useSeedableInitialData(initialData),
  });
}

/** Новинки — канонічна добірка головної */
export function useNewProducts(initialData?: HomeProduct[]) {
  const view = useViewerPriceKey();
  return useQuery({
    queryKey: priceViewKey(products.variant('new'), view),
    meta: VIEWER_PRICED_META,
    enabled: view !== null,
    queryFn: (): Promise<HomeProduct[]> => getNewProducts(),
    initialData: useSeedableInitialData(initialData),
  });
}

/** Кореневі категорії каталогу */
export function useRootSections(initialData?: HomeSection[]) {
  return useQuery({
    queryKey: sections.variant('root'),
    queryFn: (): Promise<HomeSection[]> => getRootSections(),
    initialData,
  });
}

/** Опції посекційної добірки: `initialData` приходить із SSR-лоадера */
export interface SectionProductsOptions {
  initialData?: HomeProduct[];
}

/**
 * Товари однієї категорії — для посекційної добірки.
 *
 * Дані префетчить SSR-лоадер головної й передає через `initialData`: разом зі
 * `staleTime` це прибирає N+1 — карусель не ходить на сервер під час рендеру.
 */
export function useSectionProducts(
  section: HomeSection,
  options?: SectionProductsOptions,
) {
  const view = useViewerPriceKey();
  return useQuery({
    // Іменований namespace `catalogKeys` — щоб добірка головної не ділила
    // ключ кешу з `useCatalogProductsQuery` (сторінка розділу): той самий
    // `sectionId` під різними формами вибірки колись підмінював дані.
    queryKey: priceViewKey(catalogKeys.sectionProducts(section.id), view),
    meta: VIEWER_PRICED_META,
    enabled: view !== null,
    initialData: useSeedableInitialData(options?.initialData),
    staleTime: 60_000,
    queryFn: (): Promise<HomeProduct[]> =>
      getSectionProducts({ data: section }),
  });
}
