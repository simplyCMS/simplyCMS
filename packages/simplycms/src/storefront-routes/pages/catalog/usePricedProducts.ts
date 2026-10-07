// Резолв цін вибірки каталогу середовищем вітрини (Е6в-10, Е6в-11).

import { useMemo } from 'react';
import { useDiscountEnvironment } from 'simplycms/core/hooks/useDiscountEnvironment';
import { priceCatalogRow } from '../pricing/priceCatalogRow';
import type { RawCatalogProduct } from './useCatalogProductsQuery';

/**
 * Тип ціни, ліс знижок і `now` — з ОДНОГО середовища; ціну рахує
 * `priceForCard`.
 *
 * 🔴 Поки середовища немає, `products` — `undefined`: сітка лишається на
 * серверному списку з базовими цінами (SSR), а не показує картки без ціни
 * чи з базою, яка за мить зміниться на персональну.
 *
 * 🔴 Обидва запити (вибірка й середовище) стартують безумовно й паралельно.
 */
export function usePricedProducts(
  rawProducts: RawCatalogProduct[] | undefined,
) {
  const { data: env, isLoading } = useDiscountEnvironment();

  const products = useMemo(() => {
    if (!rawProducts || !env) return undefined;
    return rawProducts.map((p) => priceCatalogRow(p, env));
  }, [rawProducts, env]);

  return { products, isLoading };
}

/** Товар вибірки з резолвленою ціною — саме він їде у фільтри й у сітку. */
export type PricedProduct = NonNullable<
  ReturnType<typeof usePricedProducts>['products']
>[number];
