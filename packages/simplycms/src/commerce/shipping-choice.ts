import type { PlaceOrderRejection } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  findShippingZoneIn,
  resolveShippingRate,
} from 'simplycms/domain/shipping';
import type {
  ShippingPricing,
  ShippingSnapshot,
} from 'simplycms/contracts/shipping-providers';
import { loadShippingDirectory } from './shipping-directory';
import {
  resolveDestination,
  type DestinationInput,
} from './shipping-providers';
import type {
  ShippingDirectory,
  ShippingMethodRow,
  ShippingZoneRow,
} from './shipping-types';

/** Вибір доставки, який покупець (чекаут) або замовлення (адмінка) зробили. */
export interface ShippingChoiceInput extends DestinationInput {
  methodId: string | null;
}

/** Провалідований вибір: метод, зона за містом і довідник, із якого брати тариф. */
export interface ShippingChoice {
  method: ShippingMethodRow;
  zone: ShippingZoneRow | null;
  directory: ShippingDirectory;
  /** Знімок для `orders.shipping_data` (Е6а-8): назва способу й пункт НА МОМЕНТ вибору. */
  snapshot: ShippingSnapshot;
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

  // Куди везти — вирішує ПРОВАЙДЕР способу, не `code` (Е6а-9): правила
  // самовивозу й адресної доставки (точка цього способу, обов'язкове місто)
  // живуть у `resolveDestination`, тож чекаут, адмінка й UI не розходяться.
  const destination = await resolveDestination(db, method, input);
  if (typeof destination === 'string') return destination;

  const zone = findShippingZoneIn(directory.zones, input.deliveryCity ?? '');
  const snapshot: ShippingSnapshot = {
    methodName: method.name,
    provider: method.provider,
    pricing: method.pricing,
    destination: destination.snapshot,
  };
  return { method, zone, directory, snapshot };
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
): { cost: number; pricing: ShippingPricing } | null {
  const rate = resolveShippingRate(
    { method: choice.method, zone: choice.zone, cart: { items: [], subtotal } },
    choice.directory.rates,
  );
  return rate === null ? null : { cost: rate.cost, pricing: rate.pricing };
}
