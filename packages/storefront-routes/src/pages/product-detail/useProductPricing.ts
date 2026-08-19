// Ціни картки товару: рушій знижок + тип ціни покупця.

import { useMemo } from 'react';
import { usePriceType } from '@simplycms/core/hooks/usePriceType';
import {
  useDiscountGroups,
  useDiscountContext,
} from '@simplycms/core/hooks/useDiscountedPrice';
import { buildModificationPrices, resolveCurrentPricing } from './pricing';
import type {
  CurrentPricing,
  ModificationPrice,
  ProductDetailProduct,
  ProductModificationRow,
  ProductSectionRef,
} from './types';

export interface ProductPricingInput {
  product: ProductDetailProduct | null | undefined;
  section: ProductSectionRef | null;
  hasModifications: boolean;
  modifications: ProductModificationRow[];
  selectedMod: ProductModificationRow | undefined;
}

export interface ProductPricing {
  modificationPrices: Record<string, ModificationPrice>;
  /** `null` — товару ще (або вже) немає, рахувати нема що. */
  current: CurrentPricing | null;
}

export function useProductPricing({
  product,
  section,
  hasModifications,
  modifications,
  selectedMod,
}: ProductPricingInput): ProductPricing {
  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const { data: discountGroups = [] } = useDiscountGroups();
  const discountCtx = useDiscountContext();

  const modificationPrices = useMemo(() => {
    if (!product) return {};
    return buildModificationPrices({
      product,
      section,
      modifications,
      priceTypeId,
      defaultPriceTypeId,
      discountGroups,
      discountCtx,
    });
  }, [
    product,
    section,
    modifications,
    priceTypeId,
    defaultPriceTypeId,
    discountGroups,
    discountCtx,
  ]);

  const current = useMemo(() => {
    if (!product) return null;
    return resolveCurrentPricing({
      product,
      section,
      hasModifications,
      selectedMod,
      priceTypeId,
      defaultPriceTypeId,
      discountGroups,
      discountCtx,
    });
  }, [
    product,
    section,
    hasModifications,
    selectedMod,
    priceTypeId,
    defaultPriceTypeId,
    discountGroups,
    discountCtx,
  ]);

  return { modificationPrices, current };
}
