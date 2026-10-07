import type { PlaceOrderInput, PlaceOrderRejection } from 'simplycms/contracts';
import type {
  ShippingPricing,
  ShippingSnapshot,
} from 'simplycms/contracts/shipping-providers';
import {
  priceItems,
  quoteShippingCost,
  validateShippingChoice,
  type NewOrderItem,
  type ShippingMethodRow,
} from 'simplycms/commerce';
import { toCents } from 'simplycms/domain/pricing';
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
  /** Режим ціни способу — їде в квоту, щоб підсумок не показав `carrier` як «Безкоштовно» (Е6а-18). */
  shippingPricing: ShippingPricing;
  /** Знімок доставки для `orders.shipping_data` (Е6а-8). */
  shippingSnapshot: ShippingSnapshot;
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
    deliveryAddress: input.deliveryAddress,
    pickupPointId: input.pickupPointId,
  });
  if (typeof choice === 'string') return { ok: false, reason: choice };

  const items = await priceItems(db, userId, input.items);
  if (items === 'not_purchasable')
    return { ok: false, reason: 'not_purchasable' };

  // 🔴 Суми — цілими центами (Е6в-9), як і квота кошика (`quote-cart.ts`):
  // float-сума `0.1 + 0.2` дала б 0.30000000000000004, і квота кошика з
  // квотою оформлення розійшлися б на копійку — а з ними й поріг тарифу
  // «безкоштовно від» до і після вибору способу доставки.
  const subtotalCents = items.reduce(
    (sum, i) => sum + toCents(i.price) * i.quantity,
    0,
  );
  const subtotal = subtotalCents / 100;
  const shipping = quoteShippingCost(choice, subtotal);
  // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
  if (shipping === null) return { ok: false, reason: 'shipping_unavailable' };
  const shippingCost = shipping.cost;

  return {
    ok: true,
    method: choice.method,
    items,
    subtotal,
    shippingCost,
    shippingPricing: shipping.pricing,
    shippingSnapshot: choice.snapshot,
    total: (subtotalCents + toCents(shippingCost)) / 100,
  };
}
