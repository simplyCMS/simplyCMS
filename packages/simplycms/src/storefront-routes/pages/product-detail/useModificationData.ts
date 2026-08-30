// Дані модифікацій товару: сортований список, характеристики й залишки.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ModificationStockInfo } from 'simplycms/core/components/catalog/ModificationSelector';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import { AGGREGATE } from 'simplycms/contracts/entities';
import { getModificationData } from '../../server/products';
import type { ProductDetailProduct, ProductModificationRow } from './types';

export interface ModificationData {
  /** Модифікації, відсортовані: спершу дефолтна, далі за `sort_order`. */
  modifications: ProductModificationRow[];
  propertyValuesByModification:
    Record<string, ProductPropertyValueViewModel[]> | undefined;
  stockByModification: Record<string, ModificationStockInfo> | undefined;
}

/**
 * Характеристики й наявність модифікацій — ОДИН серверний виклик.
 *
 * 🔴 Було два клієнтські запити, і другий бив у `rpc('get_stock_info')` по
 * КОЖНІЙ модифікації окремо. Функції в схемі v2 немає взагалі (B13), а
 * правило наявності («є залишок або статус „під замовлення“») переїхало в
 * серверний лоадер без змін.
 */
export function useModificationData(
  product: ProductDetailProduct | null | undefined,
): ModificationData {
  const productId = product?.id;

  const { data } = useQuery({
    queryKey: [...AGGREGATE.modificationData.key, productId ?? ''],
    queryFn: () =>
      getModificationData({ data: { productId: productId as string } }),
    enabled: !!productId,
    staleTime: 30_000,
  });

  const modifications = useMemo(() => {
    const mods = product?.product_modifications ?? [];
    return [...mods].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.sort_order - b.sort_order;
    });
  }, [product]);

  return {
    modifications,
    propertyValuesByModification: data?.propertyValues,
    stockByModification: data?.stock,
  };
}
