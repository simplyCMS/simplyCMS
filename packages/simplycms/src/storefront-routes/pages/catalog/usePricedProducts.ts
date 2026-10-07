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
 * 🔴 Збій середовища — `pricesFailed` з `retryPrices` (F1 фінального
 * рев'ю): сітка показує помилку з «Повторити», а не лишається назавжди на
 * SSR-списку з мовчки мертвими фільтрами й сортуванням.
 *
 * 🔴 Обидва запити (вибірка й середовище) стартують безумовно й паралельно.
 */
export function usePricedProducts(
  rawProducts: RawCatalogProduct[] | undefined,
) {
  const { data: env, isLoading, isError, refetch } = useDiscountEnvironment();

  const products = useMemo(() => {
    if (!rawProducts || !env) return undefined;
    return rawProducts.map((p) => priceCatalogRow(p, env));
  }, [rawProducts, env]);

  return { products, isLoading, pricesFailed: isError, retryPrices: refetch };
}

/** Товар вибірки з резолвленою ціною — саме він їде у фільтри й у сітку. */
export type PricedProduct = NonNullable<
  ReturnType<typeof usePricedProducts>['products']
>[number];
