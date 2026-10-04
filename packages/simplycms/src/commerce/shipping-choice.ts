import type { PlaceOrderRejection } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  findShippingZoneIn,
  resolveShippingRate,
} from 'simplycms/domain/shipping';
import { loadShippingDirectory } from './shipping-directory';
import type {
  ShippingDirectory,
  ShippingMethodRow,
  ShippingZoneRow,
} from './shipping-types';

/** Вибір доставки, який покупець (чекаут) або замовлення (адмінка) зробили. */
export interface ShippingChoiceInput {
  methodId: string | null;
  deliveryCity: string | null;
  pickupPointId: string | null;
}

/** Провалідований вибір: метод, зона за містом і довідник, із якого брати тариф. */
export interface ShippingChoice {
  method: ShippingMethodRow;
  zone: ShippingZoneRow | null;
  directory: ShippingDirectory;
}

export type ShippingChoiceRejection = Extract<
  PlaceOrderRejection,
  'shipping_unavailable' | 'pickup_point_invalid'
>;

/**
 * Перевірка вибору доставки БЕЗ тарифу (К3-Е5б, Е5б-2).
 *
 * 🔴 Рівно ті перевірки, що жили в `prepareCheckout` до переїзду, і в тому
 * самому порядку: чекаут кличе цю функцію ДО ціноутворення (пріоритет відмов
 * «доставка → точка → товар» незмінний), а тариф — окремо `quoteShippingCost`
 * після, бо він залежить від `subtotal`. Адмінка кличе ту саму пару з полями
 * рядка `orders`, тож перерахунок доставки замовлення й чекаут не розходяться.
 */
export async function validateShippingChoice(
  db: ActorDb,
  input: ShippingChoiceInput,
): Promise<ShippingChoice | ShippingChoiceRejection> {
  const directory = await loadShippingDirectory(db);
  const method = directory.methods.find(
    (m) => m.id === input.methodId && m.is_active,
  );
  if (!method) return 'shipping_unavailable';

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
  if (isPickup && !point) return 'pickup_point_invalid';
  if (!isPickup && input.pickupPointId) return 'pickup_point_invalid';

  // 🔴 Місто визначає ЗОНУ, а зона — тариф: це гроші (рев'ю M7). Порожнє
  // місто для НЕ-pickup методу мовчки падало б на ДЕФОЛТНУ зону
  // (`findShippingZoneIn(zones, '')` завжди повертає її) — тобто тариф
  // обирала б відсутність даних, а не покупець. Pickup міста не потребує:
  // адресу видачі задає точка, а не місто.
  if (!isPickup && !input.deliveryCity) return 'shipping_unavailable';

  const zone = findShippingZoneIn(directory.zones, input.deliveryCity ?? '');
  return { method, zone, directory };
}

/**
 * Вартість доставки провалідованого вибору від `subtotal`.
 *
 * `null` — жодного застосовного тарифу (метод без тарифу, `min_order_amount`
 * не досягнуто, `max_order_amount` перевищено): це НЕ «безкоштовно», а відмова,
 * і викликач перетворює її на власний код (`shipping_unavailable` чекауту,
 * 409 `order_shipping_unavailable` адмінки).
 */
export function quoteShippingCost(
  choice: ShippingChoice,
  subtotal: number,
): number | null {
  const rate = resolveShippingRate(
    { method: choice.method, zone: choice.zone, cart: { items: [], subtotal } },
    choice.directory.rates,
  );
  return rate === null ? null : rate.cost;
}
