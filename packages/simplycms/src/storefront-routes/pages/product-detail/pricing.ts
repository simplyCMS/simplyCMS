// Чисті обчислення цін картки товару (перенесено з контейнера без зміни
// логіки — контракт тем v3, Фаза 3).

import { applyDiscount } from 'simplycms/core/hooks/useDiscountedPrice';
import type {
  DiscountContext,
  DiscountGroup,
  DiscountResult,
} from 'simplycms/domain/discounts';
import type { StockStatus } from 'simplycms/contracts';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice, type PriceEntry } from 'simplycms/domain/pricing';
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

/** Картка — одна штука поза кошиком: «від N шт» і «від суми» тут мовчать. */
const cardContext = (
  actor: DiscountUserContext,
  item: Omit<DiscountContext['item'], 'quantity'>,
): Omit<DiscountContext, 'now'> => ({
  customer: { categoryId: actor.userCategoryId, isLoggedIn: actor.isLoggedIn },
  item: { ...item, quantity: 1 },
  cart: { total: 0 },
});

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
      const discountResult = applyDiscount(
        modPrice,
        input.discountGroups,
        cardContext(input.discountCtx, {
          productId: product.id,
          modificationId: mod.id,
          sectionId: section?.id || null,
        }),
      );
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

  const stockStatus: StockStatus | null = hasModifications
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
    discountResult = applyDiscount(
      price,
      input.discountGroups,
      cardContext(input.discountCtx, {
        productId: product.id,
        modificationId,
        sectionId: section?.id || null,
      }),
    );
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
    // 🔴 Те саме правило, що в бейджі й у домені: `null` — «в наявності»
    // (DEFAULT колонки — `in_stock`). Власна формула давала тут на `null`
    // вимкнену кнопку при доступному товарі.
    isInStock: isPurchasable(stockStatus),
    discountPercent:
      oldPrice && price && oldPrice > price
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : null,
  };
}
