// Прив'язки slot-компонентів картки товару (контракт тем v3, Фаза 3).

import { createContext, useContext, type ReactNode } from 'react';
import type { ModificationStockInfo } from '@simplycms/core/components/catalog/ModificationSelector';
import type { AddToCartItem } from '../../views/slots/ProductAddToCart';
import type { ModificationPrice, ProductModificationRow } from './types';

/** Усе, що контейнер прибінджує до реквізитів картки. */
export interface ProductDetailBindings {
  /** Контекст хуків плагінів перед блоком інформації та в ряду бейджів. */
  pluginContext: Record<string, unknown>;
  /** Контекст хука плагінів після вмісту сторінки (з характеристиками). */
  pluginAfterContext: Record<string, unknown>;
  stockStatus: string | null;
  price: number | undefined;
  oldPrice: number | null | undefined;
  modifications: ProductModificationRow[];
  selectedModId: string;
  onSelectModification: (modId: string) => void;
  modificationPrices: Record<string, ModificationPrice>;
  stockByModification: Record<string, ModificationStockInfo> | undefined;
  cartItem: AddToCartItem | null;
  isInStock: boolean;
  /** Товар без модифікацій; для товару з модифікаціями — `null`. */
  availabilityProductId: string | null;
  availabilityModificationId: string | null;
  productId: string;
}

const BindingsContext = createContext<ProductDetailBindings | null>(null);

/**
 * 🔴 Чому прив'язки їдуть контекстом, а не замиканнями.
 *
 * View отримує слоти як КОМПОНЕНТИ. Якби контейнер створював їх у рендері
 * (замикання над свіжими значеннями), ідентичність типу мінялася б щорендеру
 * — React перемонтовував би піддерева слотів (відгуки, залишки, плагіни)
 * замість перерендеру. Тому компоненти слотів модуль-рівневі й СТАЛІ, а
 * свіжі значення читають із цього контексту.
 */
export function ProductDetailSlotBindings({
  value,
  children,
}: {
  value: ProductDetailBindings;
  children: ReactNode;
}) {
  return (
    <BindingsContext.Provider value={value}>
      {children}
    </BindingsContext.Provider>
  );
}

export function useProductDetailBindings(): ProductDetailBindings {
  const value = useContext(BindingsContext);
  if (!value) {
    throw new Error(
      'ProductDetail slots must be rendered inside <ProductDetailSlotBindings>',
    );
  }
  return value;
}
