import type { PlaceOrderInput, PlaceOrderRejection } from 'simplycms/contracts';
import {
  priceItems,
  quoteShippingCost,
  validateShippingChoice,
  type NewOrderItem,
  type ShippingMethodRow,
} from 'simplycms/commerce';
import type { ActorDb } from './db';

/**
 * Що рахує підготовка чекауту, коли довідники й ціни узгоджені.
 *
 * 🔴 Рев'ю M-2: точка видачі (`PickupPointRow`) сюди НЕ виходить — вона
 * потрібна лише ЛОКАЛЬНО, щоб підтвердити `pickup_point_invalid`
 * (`input.pickupPointId` уже несе саму адресу як id, більше нікому нічого з
 * рядка точки не треба). `method` лишається — єдиний споживач,
 * `toOrderInput`, читає з нього `code` замість повторного `select` по
 * `shipping_methods`, який `prepareCheckout` уже провалидував на
 * `is_active`.
 */
export interface PreparedCheckout {
  method: ShippingMethodRow;
  items: NewOrderItem[];
  subtotal: number;
  shippingCost: number;
  /**
   * 🔴 Рахується ТУТ, а не в обох викликачах (рев'ю I1): `total` — число під
   * `id="checkout-total"`, яке звірятиме live-smoke, і саме сюди адитивно
   * приїде беклог `expectedTotal`/`total_changed`. Дві копії формули
   * `subtotal + shippingCost` сьогодні механічно тотожні, але гейт M-10a
   * тоді порівнював би два числа, пораховані ОДНІЄЮ формулою двічі, — це
   * слабший доказ, ніж «показане = записане».
   */
  total: number;
}

export type PrepareCheckoutResult =
  | ({ ok: true } & PreparedCheckout)
  | { ok: false; reason: PlaceOrderRejection };

/**
 * Підготовка чекауту — довідники, ціни й тариф БЕЗ запису (розділ M рішень
 * архітектора: серверна квота).
 *
 * 🔴 Це ТІЛО колишнього `placeOrderFor` від `loadShippingDirectory` до
 * `resolveShippingRate` включно, винесене БЕЗ ЗМІН ЛОГІКИ: і оформлення
 * (`place-order.ts`), і квота (`quote-checkout.ts`) кличуть саме цю функцію
 * в одній транзакції актора, тож «показане покупцю = записане в БД»
 * тримається ЗА ПОБУДОВОЮ, а не звіркою двох реалізацій. Відмови — ті самі
 * три коди, четвертого немає (рішення E).
 */
export async function prepareCheckout(
  db: ActorDb,
  input: PlaceOrderInput,
  userId: string | null,
): Promise<PrepareCheckoutResult> {
  // 🔴 Порожній кошик — відмова ДО priceItems, а не лише `.min(1)` у
  // T5-схемі (рев'ю M2): обидва викликачі (`placeOrderFor`, `quoteCheckoutFor`)
  // кличуться напряму (харнес, майбутній не-Zod клієнт) в обхід валідатора
  // однієї RPC. Гвард живе в СПІЛЬНІЙ функції, а не дублюється в кожному
  // викликачі (рев'ю #9 — дублікат був би саме тим класом розбіжності, з
  // яким весь розділ M бореться): без нього `inArray(col, [])` у drizzle
  // тихо повертає `false` (не кидок), цикл цін не виконується, і пішло б
  // замовлення з нуля позицій і `total = 0`.
  if (input.items.length === 0) {
    return { ok: false, reason: 'not_purchasable' };
  }

  // Перевірка доставки — ДО ціноутворення (пріоритет відмов «доставка →
  // точка → товар» незмінний); тариф — після, бо залежить від `subtotal`.
  // Обидві функції — `simplycms/commerce`, спільні з адмінкою (К3-Е5б).
  const choice = await validateShippingChoice(db, {
    methodId: input.shippingMethodId,
    deliveryCity: input.deliveryCity,
    pickupPointId: input.pickupPointId,
  });
  if (typeof choice === 'string') return { ok: false, reason: choice };

  const items = await priceItems(db, userId, input.items);
  if (items === 'not_purchasable')
    return { ok: false, reason: 'not_purchasable' };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingCost = quoteShippingCost(choice, subtotal);
  // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
  if (shippingCost === null)
    return { ok: false, reason: 'shipping_unavailable' };

  return {
    ok: true,
    method: choice.method,
    items,
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
  };
}
