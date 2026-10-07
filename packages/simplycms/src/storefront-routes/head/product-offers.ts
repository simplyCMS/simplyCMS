import type { PriceEntry, StockStatus } from 'simplycms/contracts';
import {
  isPurchasable,
  schemaOrgAvailability,
} from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';

/** Пара типів ціни гостя — з `loadGuestPriceTypes` лоадера сторінки (F5b). */
export interface GuestPriceTypes {
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
}

/** Мінімум товару для `offers`: структурний тип — тека `head` клієнт-безпечна. */
export interface ProductOffersInput {
  stock_status: StockStatus | null;
  has_modifications: boolean | null;
  product_modifications: ReadonlyArray<{
    id: string;
    stock_status: StockStatus | null;
  }>;
  product_prices: PriceEntry[];
  guest_price_types: GuestPriceTypes;
}

const CURRENCY = 'UAH';

/**
 * `offers` Product JSON-LD (F9 фінального рев'ю К3-Е6в) — ГОСТЬОВА ціна:
 * `resolvePrice` за типами гостя (тип дефолтної категорії, відкат —
 * глобальний дефолтний), тим самим правилом, що SSR-списки й `cardPrice`.
 * Знижки не застосовуються (К3-Е6в-1).
 *
 * 🔴 Без гостьової ціни — `null` (поле `offers` не виводиться): «перша ціна»
 * іншого типу показала б пошуковику гуртову ціну, а 0 — неправду.
 *
 * Товар із модифікаціями — `AggregateOffer` (`lowPrice`/`highPrice`) за
 * гостьовими цінами ДОСТУПНИХ модифікацій; якщо доступних із ціною немає —
 * за всіма з ціною, `OutOfStock`.
 */
export function productOffers(
  product: ProductOffersInput,
): Record<string, unknown> | null {
  const { priceTypeId, defaultPriceTypeId } = product.guest_price_types;
  const priceOf = (modificationId: string | null) =>
    resolvePrice(
      product.product_prices,
      priceTypeId,
      defaultPriceTypeId,
      modificationId,
    ).price;

  if (!product.has_modifications) {
    const price = priceOf(null);
    if (price === null) return null;
    return {
      '@type': 'Offer',
      priceCurrency: CURRENCY,
      price,
      availability: schemaOrgAvailability(product.stock_status),
    };
  }

  const priced = product.product_modifications.flatMap((m) => {
    const price = priceOf(m.id);
    return price === null
      ? []
      : [{ price, buyable: isPurchasable(m.stock_status) }];
  });
  const buyable = priced.filter((p) => p.buyable);
  const range = buyable.length > 0 ? buyable : priced;
  if (range.length === 0) return null;
  const prices = range.map((p) => p.price);
  return {
    '@type': 'AggregateOffer',
    priceCurrency: CURRENCY,
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: range.length,
    availability:
      buyable.length > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
  };
}
