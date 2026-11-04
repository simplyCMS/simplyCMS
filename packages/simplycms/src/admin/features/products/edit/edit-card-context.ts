import type { QueryClient } from '@tanstack/react-query';
import { invalidateCollection, productsCollection } from 'simplycms/admin-data';
import type { TranslationStatus } from '../../translations/translation-context';
import type { ProductCardContextValue } from './product-card-context';
import type { ProductCardState } from './useProductCardState';

/**
 * Контекст полів картки ІСНУЮЧОГО товару зі стану картки: що знають поля про
 * збережений знімок (адреси, модифікації в БД, статуси перекладів) і куди
 * повідомляють про окремі команди (адреса, залишки, конфлікт версії).
 */
export function editCardContext(
  productId: string,
  s: ProductCardState,
  queryClient: QueryClient,
): ProductCardContextValue {
  const { state, rows } = s;
  return {
    productId,
    entityId: productId,
    paths: state.agg.paths,
    persistedModificationIds: new Set(
      state.baseline.modifications.map((m) => m.id),
    ),
    modificationErrors: rows.modificationErrors,
    valueErrors: rows.valueErrors,
    clearValueError: rows.clearValueError,
    onConflict: () => s.setConflict(true),
    onStockStatus: s.onStockStatus,
    // `products.setPath` піднімає `products.version`, а колекцію клієнт не чіпає:
    // без інвалідації список видалив би товар зі старою версією (412).
    onPathSaved: (locale, path) => {
      void invalidateCollection(queryClient, productsCollection);
      s.setState((cur) => ({
        ...cur,
        agg: { ...cur.agg, paths: { ...cur.agg.paths, [locale]: path } },
      }));
    },
    statusOfModificationName: (id, l) =>
      state.agg.modifications.find((m) => m.id === id)?.texts[l]?.status as
        TranslationStatus | undefined,
    statusOfValueText: (id, l) =>
      state.agg.propertyValues.find((v) => v.id === id)?.textStatus?.[l] as
        TranslationStatus | undefined,
  };
}
