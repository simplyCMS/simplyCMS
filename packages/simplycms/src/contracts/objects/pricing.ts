// Доменні типи ціноутворення. Винесено з core/lib/priceUtils.

/** Запис ціни товару/модифікації для конкретного типу ціни. */
export interface PriceEntry {
  price_type_id: string;
  price: number;
  old_price: number | null;
  modification_id: string | null;
}

/** Результат вибору ціни (resolvePrice). */
export interface ResolvedPrice {
  price: number | null;
  oldPrice: number | null;
}

/** Тип ціни (price list), напр. роздріб / опт. */
export interface PriceType {
  id: string;
  name: string;
  is_default: boolean;
}
