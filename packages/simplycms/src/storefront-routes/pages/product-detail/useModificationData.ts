// Дані модифікацій товару: сортований список, характеристики й залишки.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import type { ModificationStockInfo } from '@simplycms/core/components/catalog/ModificationSelector';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import type { ProductDetailProduct, ProductModificationRow } from './types';

export interface ModificationData {
  /** Модифікації, відсортовані: спершу дефолтна, далі за `sort_order`. */
  modifications: ProductModificationRow[];
  propertyValuesByModification:
    Record<string, ProductPropertyValueViewModel[]> | undefined;
  stockByModification: Record<string, ModificationStockInfo> | undefined;
}

export function useModificationData(
  product: ProductDetailProduct | null | undefined,
): ModificationData {
  const supabase = useSupabaseClient();

  const modificationIds = useMemo(() => {
    if (!product?.product_modifications) return [];
    return (product.product_modifications as Array<{ id: string }>).map(
      (m) => m.id,
    );
  }, [product]);

  const { data: propertyValuesByModification } = useQuery({
    queryKey: ['modification-property-values', modificationIds],
    queryFn: async () => {
      if (modificationIds.length === 0) return {};

      const { data, error } = await supabase
        .from('modification_property_values')
        .select(
          `
          modification_id,
          property_id,
          value,
          numeric_value,
          option_id,
          property_options:option_id(id, slug),
          section_properties:property_id(id, name, slug, property_type, has_page)
        `,
        )
        .in('modification_id', modificationIds);

      if (error) throw error;

      // Групуємо за modification_id
      const grouped: Record<string, ProductPropertyValueViewModel[]> = {};
      data?.forEach((v) => {
        if (!grouped[v.modification_id]) {
          grouped[v.modification_id] = [];
        }
        grouped[v.modification_id].push({
          property_id: v.property_id,
          value: v.value,
          numeric_value: v.numeric_value,
          option_id: v.option_id,
          option: v.property_options as ProductPropertyValueViewModel['option'],
          property:
            v.section_properties as ProductPropertyValueViewModel['property'],
        });
      });

      return grouped;
    },
    enabled: modificationIds.length > 0,
  });

  const { data: stockByModification } = useQuery({
    queryKey: ['modifications-stock', modificationIds],
    queryFn: async () => {
      if (modificationIds.length === 0) return {};

      const stockMap: Record<string, ModificationStockInfo> = {};

      // Залишки по всіх модифікаціях — паралельно
      await Promise.all(
        modificationIds.map(async (modId: string) => {
          const { data, error } = await supabase.rpc('get_stock_info', {
            p_product_id: undefined,
            p_modification_id: modId,
          });

          if (!error && data?.[0]) {
            const row = data[0];
            stockMap[modId] = {
              totalQuantity: row.total_quantity ?? 0,
              isAvailable: row.is_available ?? false,
            };
          } else {
            stockMap[modId] = { totalQuantity: 0, isAvailable: false };
          }
        }),
      );

      return stockMap;
    },
    enabled: modificationIds.length > 0,
    staleTime: 30000,
  });

  const modifications = useMemo(() => {
    if (!product?.product_modifications) return [];
    const mods = product.product_modifications as ProductModificationRow[];
    return [...mods].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.sort_order - b.sort_order;
    });
  }, [product]);

  return {
    modifications,
    propertyValuesByModification,
    stockByModification,
  };
}
