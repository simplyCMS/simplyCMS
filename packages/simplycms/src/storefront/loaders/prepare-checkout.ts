import type { PlaceOrderInput, PlaceOrderRejection } from 'simplycms/contracts';
import {
  findShippingZoneIn,
  resolveShippingRate,
} from 'simplycms/domain/shipping';
import type { ActorDb } from './db';
import { priceCheckoutItems } from './checkout-items';
import type { NewOrderItem } from './entities/new-order';
import { loadShippingDirectory, type ShippingMethodRow } from './shipping';
import type { PickupPointRow } from './pickup-points';

/** Що рахує підготовка чекауту, коли довідники й ціни узгоджені. */
export interface PreparedCheckout {
  method: ShippingMethodRow;
  point: PickupPointRow | null;
  items: NewOrderItem[];
  subtotal: number;
  shippingCost: number;
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
    point,
    items,
    subtotal,
    shippingCost: rate.cost,
  };
}
