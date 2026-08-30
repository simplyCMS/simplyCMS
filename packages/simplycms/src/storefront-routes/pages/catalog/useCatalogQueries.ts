// Довідкові запити каталогу: розділи, числові характеристики, опції
// характеристик (контракт тем v3, Фаза 4).
//
// 🔴 Усі — через `createServerFn`. Ті самі вибірки робить SSR-лоадер, тож
// клієнт і сервер відповідають ОДНИМ запитом, а не двома схожими: розділи
// після гідрації вже не можуть розійтися з тими, що в серверному HTML.

import { useQuery } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import {
  getCatalogSection,
  getCatalogSections,
  getFilterOptions,
  getSectionNumericProperties,
} from '../../server/catalog';
import type { SectionRow } from 'simplycms/storefront/loaders';

/** Рядок розділу у формі, яку віддає SSR-лоадер і споживають чипси. */
export type CatalogSectionRow = SectionRow;

const sections = entityKey(ENTITY.sections);
const sectionProperties = entityKey(ENTITY.sectionProperties);
const propertyOptions = entityKey(ENTITY.propertyOptions);

/** Усі активні розділи — чипси над списком товарів. */
export function useSectionsQuery(initialSections?: CatalogSectionRow[]) {
  return useQuery({
    queryKey: sections.list(),
    queryFn: (): Promise<CatalogSectionRow[]> => getCatalogSections(),
    initialData: initialSections,
  });
}

/** Розділ поточної сторінки за slug-ом. */
export function useSectionQuery(
  sectionSlug: string | undefined,
  initialSection?: CatalogSectionRow,
) {
  return useQuery({
    queryKey: sections.detail(sectionSlug ?? ''),
    queryFn: (): Promise<CatalogSectionRow | null> =>
      getCatalogSection({ data: { slug: sectionSlug as string } }),
    enabled: !!sectionSlug,
    initialData: initialSection,
  });
}

/** Числові характеристики розділу, за якими можна фільтрувати. */
export function useNumericPropertiesQuery(sectionId: string | null) {
  return useQuery({
    queryKey: sectionProperties.scoped('numeric', sectionId ?? ''),
    queryFn: () =>
      getSectionNumericProperties({
        data: { sectionId: sectionId as string },
      }),
    enabled: !!sectionId,
  });
}

/**
 * Опції характеристик — назви для бейджів активних фільтрів.
 *
 * 🔴 Ключ без розділу навмисно: запит вибирає опції ЦІЛКОМ і розділу не
 * знає, тож розділ у ключі давав би зайвий рефетч тих самих даних на кожне
 * перемикання чипсів (так було до спліту, окремими ключами на двох сторінках).
 */
export function usePropertyOptionsQuery() {
  return useQuery({
    queryKey: propertyOptions.list(),
    queryFn: () => getFilterOptions(),
  });
}
