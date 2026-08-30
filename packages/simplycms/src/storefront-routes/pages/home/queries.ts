import { useQuery } from '@tanstack/react-query';
import { catalogKeys } from 'simplycms/react-query';
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
 * чистому Postgres PostgREST не існує, тож будь-який `supabase.from(...)`
 * після гідрації просто нікуди не потрапляє. Форма даних збережена
 * дослівно — сторінка й картки не переписувались.
 */

/** Популярні товари (`is_featured`) — канонічна добірка головної */
export function useFeaturedProducts(initialData?: HomeProduct[]) {
  return useQuery({
    queryKey: [...products.list(), 'featured'],
    queryFn: (): Promise<HomeProduct[]> => getFeaturedProducts(),
    initialData,
  });
}

/** Новинки — канонічна добірка головної */
export function useNewProducts(initialData?: HomeProduct[]) {
  return useQuery({
    queryKey: [...products.list(), 'new'],
    queryFn: (): Promise<HomeProduct[]> => getNewProducts(),
    initialData,
  });
}

/** Кореневі категорії каталогу */
export function useRootSections(initialData?: HomeSection[]) {
  return useQuery({
    queryKey: [...sections.list(), 'root'],
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
  return useQuery({
    // Іменований namespace `catalogKeys` — щоб добірка головної не ділила
    // ключ кешу з `useCatalogProductsQuery` (сторінка розділу): той самий
    // `sectionId` під різними формами вибірки колись підмінював дані.
    queryKey: catalogKeys.sectionProducts(section.id),
    initialData: options?.initialData,
    staleTime: 60_000,
    queryFn: (): Promise<HomeProduct[]> =>
      getSectionProducts({ data: section }),
  });
}
