import type { PlaceOrderRejection } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  resolveShippingRate,
  resolveShippingZone,
} from 'simplycms/domain/shipping';
import type {
  ShippingPricing,
  NewShippingSnapshot,
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
  /**
   * Зона, записана в замовленні (`orders.shipping_zone_id`). Лише адмінка:
   * перерахунок бере її, а не визначає наново. Заданий, але поза активними →
   * зона `null` (Р6); `null`/не передано (чекаут, замовлення до релізу або зона
   * видалена за `SET NULL`) → зона за призначенням (Д5).
   */
  recordedZoneId?: string | null;
}

/** Провалідований вибір: метод, зона за призначенням (`null` — не визначена) і довідник, із якого брати тариф. */
export interface ShippingChoice {
  method: ShippingMethodRow;
  zone: ShippingZoneRow | null;
  directory: ShippingDirectory;
  /** Знімок для `orders.shipping_data` (Е6а-8): назва способу й пункт НА МОМЕНТ вибору. */
  snapshot: NewShippingSnapshot;
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

  // Зону задає призначення, а не місто: точка самовивозу несе власну
  // (`zone_id`), адресна доставка йде в основну (Д3).
  // Записана зона замовлення важливіша: адмінка не змінює призначення, а зону
  // «з нуля» могли б зсунути правки довідника після оформлення.
  const zone = input.recordedZoneId
    ? (directory.zones.find((z) => z.id === input.recordedZoneId) ?? null)
    : resolveShippingZone(
        directory.zones,
        destination.point
          ? { kind: 'pickup-point', zoneId: destination.point.zone_id }
          : { kind: 'address' },
      );
  const snapshot: NewShippingSnapshot = {
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
): {
  cost: number;
  pricing: ShippingPricing;
  /** Зона й тариф, що дали ціну: їх пише замовлення (`rateId` — лише для `rates`, А2). */
  zoneId: string | null;
  rateId: string | null;
} | null {
  const rate = resolveShippingRate(
    { method: choice.method, zone: choice.zone, cart: { items: [], subtotal } },
    choice.directory.rates,
  );
  return rate === null
    ? null
    : {
        cost: rate.cost,
        pricing: rate.pricing,
        zoneId: rate.zoneId,
        rateId: rate.rateId,
      };
}
