// Ціна картки товару — ОДНА функція для всіх поверхонь (Е6в-11).

import type {
  DiscountContext,
  DiscountEnvironment,
  PriceEntry,
  ThresholdHint,
} from 'simplycms/contracts';
import {
  discountThresholdHints,
  resolveDiscount,
} from 'simplycms/domain/discounts';
import { resolvePrice } from 'simplycms/domain/pricing';

/** Позиція картки: те, за чим рушій звіряє цілі знижок. */
export interface CardItem {
  productId: string;
  modificationId: string | null;
  sectionId: string | null;
}

export interface CardPricing {
  price: number;
  basePrice: number;
  hints: ThresholdHint[];
}

/**
 * Картка — одна штука поза кошиком: `quantity: 1`, `cart.total: 0`.
 *
 * 🔴 `now` — ЛИШЕ `env.now`, серверний час запиту середовища. Годинник
 * браузера не бере участі: межа акції на картці збігається з тією, за якою
 * рахуватимуть квота й чек.
 *
 * Знижка «від 3 шт» тут не діє — вона йде підказкою на ціні порогу
 * (Е6в-12), тим самим рушієм, а не окремою формулою відсотка.
 */
export function priceForCard(
  basePrice: number,
  env: DiscountEnvironment,
  item: CardItem,
): CardPricing {
  const ctx: DiscountContext = {
    customer: {
      categoryId: env.actor.categoryId,
      isLoggedIn: env.actor.isLoggedIn,
    },
    item: { ...item, quantity: 1 },
    cart: { total: 0 },
    now: env.now,
  };
  return {
    price: resolveDiscount(basePrice, env.forest, ctx).finalPrice,
    basePrice,
    hints: discountThresholdHints(basePrice, env.forest, ctx),
  };
}

/** Поля ціни картки у формі view-model (`ProductCardViewModel`). */
export interface CardPrice {
  price: number | null;
  old_price: number | null;
  discount_hints: ThresholdHint[];
}

/**
 * База з прайсу за типом ціни СЕРЕДОВИЩА + `priceForCard`.
 *
 * Знижка, що увійшла в ціну, робить базу «старою» ціною; без знижки
 * лишається стара ціна з прайсу.
 */
export function cardPrice(
  prices: PriceEntry[],
  env: DiscountEnvironment,
  item: CardItem,
): CardPrice {
  const base = resolvePrice(
    prices,
    env.priceTypeId,
    env.defaultPriceTypeId,
    item.modificationId,
  );
  if (base.price === null)
    return { price: null, old_price: base.oldPrice, discount_hints: [] };
  const priced = priceForCard(base.price, env, item);
  const discounted = priced.price < priced.basePrice;
  return {
    price: priced.price,
    old_price: discounted ? priced.basePrice : base.oldPrice,
    discount_hints: priced.hints,
  };
}
