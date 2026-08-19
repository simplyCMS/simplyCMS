// Чисті обчислення цін картки товару (перенесено з контейнера без зміни
// логіки — контракт тем v3, Фаза 3).

import { applyDiscount } from '@simplycms/core/hooks/useDiscountedPrice';
import type {
  DiscountGroup,
  DiscountResult,
} from '@simplycms/core/lib/discountEngine';
import { resolvePrice, type PriceEntry } from '@simplycms/core/lib/priceUtils';
import type {
  CurrentPricing,
  DiscountUserContext,
  ModificationPrice,
  ProductDetailProduct,
  ProductModificationRow,
  ProductSectionRef,
} from './types';

interface PricingBase {
  product: ProductDetailProduct;
  section: ProductSectionRef | null;
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
  discountGroups: DiscountGroup[];
  discountCtx: DiscountUserContext;
}

/** Ціни всіх модифікацій (зі знижками) — для перемикача модифікацій. */
export function buildModificationPrices(
  input: PricingBase & { modifications: ProductModificationRow[] },
): Record<string, ModificationPrice> {
  const { product, section, modifications } = input;
  const productPrices = (product.product_prices ?? []) as PriceEntry[];
  const map: Record<string, ModificationPrice> = {};

  modifications.forEach((mod) => {
    const resolved = resolvePrice(
      productPrices,
      input.priceTypeId,
      input.defaultPriceTypeId,
      mod.id,
    );
    if (resolved.price === null) return;

    let modPrice = resolved.price;
    let modOldPrice = resolved.oldPrice;

    // Знижки рахуються окремо для кожної модифікації
    if (input.discountGroups.length > 0) {
      const discountResult = applyDiscount(modPrice, input.discountGroups, {
        ...input.discountCtx,
        quantity: 1,
        cartTotal: 0,
        productId: product.id,
        modificationId: mod.id,
        sectionId: section?.id || null,
      });
      if (discountResult.totalDiscount > 0) {
        modOldPrice = modPrice;
        modPrice = discountResult.finalPrice;
      }
    }

    map[mod.id] = { price: modPrice, oldPrice: modOldPrice };
  });

  return map;
}

/** Ціна, наявність і артикул поточного вибору (товар або його модифікація). */
export function resolveCurrentPricing(
  input: PricingBase & {
    hasModifications: boolean;
    selectedMod: ProductModificationRow | undefined;
  },
): CurrentPricing {
  const { product, section, hasModifications, selectedMod } = input;
  const productPrices = (product.product_prices ?? []) as PriceEntry[];

  const stockStatus: string | null = hasModifications
    ? (selectedMod?.stock_status ?? 'in_stock')
    : (product.stock_status ?? 'in_stock');
  const modificationId = hasModifications ? selectedMod?.id || null : null;
  const resolved = resolvePrice(
    productPrices,
    input.priceTypeId,
    input.defaultPriceTypeId,
    modificationId,
  );

  let price: number | undefined = resolved.price ?? undefined;
  let oldPrice: number | null | undefined = resolved.oldPrice;
  const sku = hasModifications ? selectedMod?.sku : product.sku;

  let discountResult: DiscountResult | null = null;
  let basePrice: number | undefined;
  if (price !== undefined && input.discountGroups.length > 0) {
    discountResult = applyDiscount(price, input.discountGroups, {
      ...input.discountCtx,
      quantity: 1,
      cartTotal: 0,
      productId: product.id,
      modificationId,
      sectionId: section?.id || null,
    });
    if (discountResult.totalDiscount > 0) {
      basePrice = price;
      oldPrice = price;
      price = discountResult.finalPrice;
    }
  }

  return {
    stockStatus,
    price,
    oldPrice,
    sku,
    basePrice,
    discountResult,
    isInStock: stockStatus === 'in_stock' || stockStatus === 'on_order',
    discountPercent:
      oldPrice && price && oldPrice > price
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : null,
  };
}
