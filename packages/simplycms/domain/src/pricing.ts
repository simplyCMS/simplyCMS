// Pure-логіка ціноутворення. Перенесено з core/lib/priceUtils.
// Залежить лише від типів @simplycms/objects.

import type { PriceEntry, ResolvedPrice } from "@simplycms/objects";

export type { PriceEntry, ResolvedPrice } from "@simplycms/objects";

/**
 * Обирає ціну для товару/модифікації за типом ціни користувача,
 * з відкатом до типу ціни за замовчуванням.
 */
export function resolvePrice(
  prices: PriceEntry[],
  priceTypeId: string | null,
  defaultPriceTypeId: string | null,
  modificationId: string | null = null,
): ResolvedPrice {
  if (!prices?.length) return { price: null, oldPrice: null };

  const match = (typeId: string) =>
    prices.find(
      (p) =>
        p.price_type_id === typeId &&
        (modificationId
          ? p.modification_id === modificationId
          : !p.modification_id),
    );

  if (priceTypeId) {
    const entry = match(priceTypeId);
    if (entry) return { price: entry.price, oldPrice: entry.old_price };
  }

  if (defaultPriceTypeId && defaultPriceTypeId !== priceTypeId) {
    const entry = match(defaultPriceTypeId);
    if (entry) return { price: entry.price, oldPrice: entry.old_price };
  }

  return { price: null, oldPrice: null };
}
