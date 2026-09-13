import type { PlaceOrderInput, PlaceOrderRejection } from 'simplycms/contracts';
import {
  findShippingZoneIn,
  resolveShippingRate,
} from 'simplycms/domain/shipping';
import type { ActorDb } from './db';
import { priceCheckoutItems } from './checkout-items';
import type { NewOrderItem } from './entities/new-order';
import { loadShippingDirectory, type ShippingMethodRow } from './shipping';

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
  // 🔴 Порожній кошик — відмова ДО priceCheckoutItems, а не лише `.min(1)` у
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

  const directory = await loadShippingDirectory(db);
  const method = directory.methods.find(
    (m) => m.id === input.shippingMethodId && m.is_active,
  );
  if (!method) return { ok: false, reason: 'shipping_unavailable' };

  // Pickup — за КОДОМ методу, як і UI (`CheckoutDeliveryForm`: `code === 'pickup'`):
  // pickup вимагає активну точку ЦЬОГО методу; не-pickup точки не приймає.
  const isPickup = method.code === 'pickup';
  const point = input.pickupPointId
    ? (directory.pickupPoints.find(
        (p) =>
          p.id === input.pickupPointId &&
          p.method_id === method.id &&
          p.is_active,
      ) ?? null)
    : null;
  if (isPickup && !point) return { ok: false, reason: 'pickup_point_invalid' };
  if (!isPickup && input.pickupPointId)
    return { ok: false, reason: 'pickup_point_invalid' };

  // 🔴 Місто визначає ЗОНУ, а зона — тариф: це гроші (рев'ю M7). Порожнє
  // місто для НЕ-pickup методу мовчки падало б на ДЕФОЛТНУ зону
  // (`findShippingZoneIn(zones, '')` завжди повертає її) — тобто тариф
  // обирала б відсутність даних, а не покупець. Pickup міста не потребує:
  // адресу видачі задає точка, а не місто.
  if (!isPickup && !input.deliveryCity) {
    return { ok: false, reason: 'shipping_unavailable' };
  }

  const items = await priceCheckoutItems(db, userId, input.items);
  if (items === 'not_purchasable')
    return { ok: false, reason: 'not_purchasable' };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const zone = findShippingZoneIn(directory.zones, input.deliveryCity ?? '');
  const rate = resolveShippingRate(
    { method, zone, cart: { items: [], subtotal } },
    directory.rates,
  );
  // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
  if (rate === null) return { ok: false, reason: 'shipping_unavailable' };

  return {
    ok: true,
    method,
    items,
    subtotal,
    shippingCost: rate.cost,
    total: subtotal + rate.cost,
  };
}
