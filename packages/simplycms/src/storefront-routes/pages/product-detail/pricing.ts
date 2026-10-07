// Чисті обчислення цін картки товару (контракт тем v3, Фаза 3): ціни —
// тим самим `priceForCard`, що на всіх картках (Е6в-11).

import type { DiscountEnvironment, StockStatus } from 'simplycms/contracts';
import { isPurchasable } from 'simplycms/domain/inventory';
import type { PriceEntry } from 'simplycms/domain/pricing';
import {
  cardPrice,
  type CardItem,
  type CardPrice,
} from '../pricing/priceForCard';
import type {
  CurrentPricing,
  ModificationPrice,
  ProductDetailProduct,
  ProductModificationRow,
  ProductSectionRef,
} from './types';

interface PricingBase {
  product: ProductDetailProduct;
  section: ProductSectionRef | null;
  /** `undefined` — середовища ще немає (SSR): ціни немає, як і раніше. */
  env: DiscountEnvironment | undefined;
}

/** Ціна позиції: до середовища — порожньо, далі — `cardPrice`. */
function priceOf(input: PricingBase, modificationId: string | null): CardPrice {
  const prices = (input.product.product_prices ?? []) as PriceEntry[];
  const item: CardItem = {
    productId: input.product.id,
    modificationId,
    sectionId: input.section?.id || null,
  };
  // Без середовища невідомий навіть тип ціни — бази немає.
  if (!input.env) return { price: null, old_price: null, discount_hints: [] };
  return cardPrice(prices, input.env, item);
}

/** Ціни всіх модифікацій (зі знижками) — для перемикача модифікацій. */
export function buildModificationPrices(
  input: PricingBase & { modifications: ProductModificationRow[] },
): Record<string, ModificationPrice> {
  const map: Record<string, ModificationPrice> = {};
  input.modifications.forEach((mod) => {
    const priced = priceOf(input, mod.id);
    if (priced.price === null) return;
    map[mod.id] = { price: priced.price, oldPrice: priced.old_price };
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
  const { product, hasModifications, selectedMod } = input;

  const stockStatus: StockStatus | null = hasModifications
    ? (selectedMod?.stock_status ?? 'in_stock')
    : (product.stock_status ?? 'in_stock');
  const modificationId = hasModifications ? selectedMod?.id || null : null;
  const priced = priceOf(input, modificationId);
  const price = priced.price ?? undefined;
  const oldPrice = priced.old_price;

  return {
    stockStatus,
    price,
    oldPrice,
    sku: hasModifications ? selectedMod?.sku : product.sku,
    hints: priced.discount_hints,
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
