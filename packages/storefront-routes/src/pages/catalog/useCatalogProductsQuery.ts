// Запит вибірки товарів каталогу (контракт тем v3, Фаза 4).

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import {
  fetchModificationStockData,
  fetchModificationPropertyValues,
  enrichProductsWithAvailability,
} from '@simplycms/core/hooks/useProductsWithStock';
import type { CatalogPropertyValue } from './types';

const CATALOG_PRODUCTS_SELECT = `
  *,
  sections(id, slug, name),
  product_modifications(id, stock_status, is_default, sort_order),
  product_prices(price_type_id, price, old_price, modification_id),
  product_property_values(property_id, value, numeric_value, option_id),
  stock_by_pickup_point(quantity)
`;

/**
 * Вибірка товарів із модифікаціями, цінами, характеристиками й залишками.
 *
 * `sectionId`:
 * - `undefined` — сторінка каталогу: беруться ВСІ активні товари, розділ
 *   потім фільтрується на клієнті (чипси перемикають вибірку без запиту);
 * - рядок — сторінка розділу: вибірка звужена запитом;
 * - `null` — сторінка розділу, розділ ще не приїхав: запит чекає.
 */
export function useCatalogProductsQuery(sectionId: string | null | undefined) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey:
      sectionId === undefined
        ? ['all-products']
        : ['section-products', sectionId],
    queryFn: async () => {
      const query = supabase
        .from('products')
        .select(CATALOG_PRODUCTS_SELECT)
        .eq('is_active', true);
      const { data, error } = await (sectionId
        ? query.eq('section_id', sectionId)
        : query);
      if (error) throw error;

      const modificationIds = data.flatMap((p) =>
        (p.product_modifications || []).map((m) => m.id),
      );

      const [modPropertyValues, modStockData] = await Promise.all([
        fetchModificationPropertyValues(supabase, modificationIds),
        fetchModificationStockData(supabase, modificationIds),
      ]);

      const mapped = data.map((product) => {
        const mods = product.product_modifications || [];
        const defaultMod =
          mods.find((m) => m.is_default) ||
          [...mods].sort((a, b) => a.sort_order - b.sort_order)[0];
        const images = product.images as string[] | null;
        const hasModifications = product.has_modifications ?? true;

        const allPropertyValues: CatalogPropertyValue[] = [
          ...(product.product_property_values || []),
          ...mods.flatMap((m) => modPropertyValues[m.id] || []),
        ];

        return {
          ...product,
          images: Array.isArray(images) ? images : [],
          section: product.sections,
          has_modifications: hasModifications,
          modifications: defaultMod ? [defaultMod] : [],
          propertyValues: allPropertyValues,
          product_prices: product.product_prices || [],
        };
      });

      return enrichProductsWithAvailability(mapped, modStockData);
    },
    enabled: sectionId !== null,
  });
}

/** Товар вибірки до резолву ціни. */
export type RawCatalogProduct = NonNullable<
  ReturnType<typeof useCatalogProductsQuery>['data']
>[number];
