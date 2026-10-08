import {
  SHIPPING_PROVIDERS,
  isShippingProviderId,
  type NewShippingDestination,
} from 'simplycms/contracts/shipping-providers';
import type { PlaceOrderRejection } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import { loadPickupPoint, type PickupPointRow } from './pickup-points';
import type { ShippingMethodRow } from './shipping-types';

/** Пункт доставки, який обрав покупець (чекаут) або зберегло замовлення. */
export interface DestinationInput {
  deliveryCity: string | null;
  deliveryAddress: string | null;
  pickupPointId: string | null;
}

export type DestinationRejection = Extract<
  PlaceOrderRejection,
  'shipping_unavailable' | 'pickup_point_invalid'
>;

export interface ResolvedDestination {
  snapshot: NewShippingDestination;
  /** Точка видачі — лише для провайдера самовивозу. */
  point: PickupPointRow | null;
}

/**
 * Перевірка пункту доставки й знімок «куди» — за ПРОВАЙДЕРОМ способу, а не за
 * `code` (Е6а-9). Правила ті самі, що жили в `validateShippingChoice`:
 * самовивіз вимагає активну точку САМЕ цього способу, адресна доставка точки
 * не приймає й вимагає місто.
 *
 * 🔴 Місто для адресної доставки обовʼязкове: порожнє мовчки падало б на
 * ДЕФОЛТНУ зону (`findShippingZoneIn(zones, '')`), тобто тариф обирала б
 * відсутність даних, а не покупець (рев'ю M7). Самовивіз міста не потребує —
 * адресу задає точка.
 */
export async function resolveDestination(
  db: ActorDb,
  method: ShippingMethodRow,
  input: DestinationInput,
): Promise<ResolvedDestination | DestinationRejection> {
  if (!isShippingProviderId(method.provider)) return 'shipping_unavailable';

  if (SHIPPING_PROVIDERS[method.provider].destination === 'pickup-point') {
    const point = input.pickupPointId
      ? await loadPickupPoint(db, input.pickupPointId, method.id)
      : null;
    if (!point) return 'pickup_point_invalid';
    return {
      point,
      snapshot: {
        kind: 'pickup-point',
        pointId: point.id,
        name: point.name,
        address: point.address,
        city: point.city,
      },
    };
  }

  if (input.pickupPointId) return 'pickup_point_invalid';
  if (!input.deliveryCity) return 'shipping_unavailable';
  return {
    point: null,
    snapshot: {
      kind: 'address',
      city: input.deliveryCity,
      address: input.deliveryAddress,
    },
  };
}
