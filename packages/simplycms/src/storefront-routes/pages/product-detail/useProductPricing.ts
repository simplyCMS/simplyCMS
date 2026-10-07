// Ціни картки товару: середовище цін вітрини (Е6в-10) + `priceForCard`.

import { useMemo } from 'react';
import { useDiscountEnvironment } from 'simplycms/core/hooks/useDiscountEnvironment';
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
  /** Середовище цін не завантажилось (F1): ціни немає, є повтор. */
  pricesFailed: boolean;
  retryPrices: () => void;
}

export function useProductPricing({
  product,
  section,
  hasModifications,
  modifications,
  selectedMod,
}: ProductPricingInput): ProductPricing {
  const { data: env, isError, refetch } = useDiscountEnvironment();

  const modificationPrices = useMemo(() => {
    if (!product) return {};
    return buildModificationPrices({
      product,
      section,
      modifications,
      env,
    });
  }, [product, section, modifications, env]);

  const current = useMemo(() => {
    if (!product) return null;
    return resolveCurrentPricing({
      product,
      section,
      hasModifications,
      selectedMod,
      env,
    });
  }, [product, section, hasModifications, selectedMod, env]);

  return {
    modificationPrices,
    current,
    pricesFailed: isError,
    retryPrices: refetch,
  };
}
