export interface PriceEntry {
  price_type_id: string;
  price: number;
  old_price: number | null;
  modification_id: string | null;
}

export function resolvePrice(
  prices: PriceEntry[],
  priceTypeId: string | null,
  defaultPriceTypeId: string | null,
  modificationId: string | null = null,
): { price: number | null; oldPrice: number | null } {
  if (!prices?.length) return { price: null, oldPrice: null };

  const match = (typeId: string) =>
    prices.find(
      (p) =>
        p.price_type_id === typeId &&
        (modificationId
          ? p.modification_id === modificationId
          : !p.modification_id)
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
