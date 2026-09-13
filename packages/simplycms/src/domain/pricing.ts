// Pure-логіка ціноутворення. Перенесено з core/lib/priceUtils.
// Залежить лише від типів simplycms/contracts.

import type { PriceEntry, ResolvedPrice } from 'simplycms/contracts';

export type { PriceEntry, ResolvedPrice } from 'simplycms/contracts';

/**
 * Округлення грошової величини до ЦЕНТІВ.
 *
 * 🔴 Не косметика: ціна позиції потрапляє в `order_items.price`, а сума —
 * в `order_items.total` і `orders.subtotal`/`total`. Без округлення
 * відсоткова знижка дає нескінченний дріб, і сума замовлення перестає
 * дорівнювати добутку показаної ціни на кількість: база 20.01, −50 %,
 * кількість 3 → ціна 10.005, `total` 30.015 (у БД 30.02), тоді як покупець
 * рахує 3 × 10.01 = 30.03. Клас пре-існуючий — до К2-Е0 те саме число
 * приходило з клієнта; етап переніс розрахунок на сервер і успадкував його,
 * тож лікуємо там, де тепер живе джерело правди.
 *
 * 🔴 `Math.round(x * 100) / 100`, а не `toFixed`: `toFixed` віддає РЯДОК і
 * ховає подвійне округлення при подальшому складанні.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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
