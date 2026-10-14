import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AGGREGATE } from 'simplycms/contracts/entities';
import {
  isShippingProviderId,
  SHIPPING_PROVIDERS,
} from 'simplycms/contracts/shipping-providers';
import {
  resolveShippingRate,
  resolveShippingZone,
  type ShippingCalculationResult,
} from 'simplycms/domain/shipping';
import {
  getShippingDirectory,
  type ShippingDirectory,
} from '../lib/shipping-directory';

export type { ShippingDirectory };

/** Порожній довідник — форма рендериться до відповіді сервера. */
const EMPTY: ShippingDirectory = {
  methods: [],
  zones: [],
  rates: [],
  pickupPoints: [],
};

/**
 * Довідники доставки + розрахунок вартості способу.
 *
 * 🔴 Розрахунок НЕ живе тут: `resolveShippingRate` і `resolveShippingZone` —
 * доменні (T1) функції, і саме вони єдине джерело правила. До В2-К1а форма
 * чекауту мала власну копію («перший тариф методу, `free_from` — нуль понад
 * поріг»), тобто ціна в списку способів і ціна в підсумку рахувалися різним
 * кодом і могли розійтися.
 *
 * 🔴 Зона визначається ПРИЗНАЧЕННЯМ, а не містом: адресна доставка — основна
 * зона, самовивіз — зона обраної точки (`pickupPointId`), як і на сервері
 * (`validateShippingChoice`). Місто покупця на ціну не впливає.
 *
 * `rateFor` повертає `undefined`, коли ціни ще не видно: спосіб самовивозу, чию
 * точку не обрано (зона невідома). `null` — спосіб недоступний (зону не
 * визначено або тарифу немає); ці два стани UI не змішує.
 */
export function useShippingDirectory(
  pickupPointId: string | null,
  subtotal: number,
) {
  const query = useQuery({
    queryKey: AGGREGATE.shippingDirectory.key,
    queryFn: (): Promise<ShippingDirectory> => getShippingDirectory(),
    staleTime: 5 * 60 * 1000,
  });

  const directory = query.data ?? EMPTY;

  const rateFor = useMemo(() => {
    const byId = new Map(directory.methods.map((m) => [m.id, m]));
    return (methodId: string): ShippingCalculationResult | null | undefined => {
      const method = byId.get(methodId);
      if (!method) return null;
      const isPickup =
        isShippingProviderId(method.provider) &&
        SHIPPING_PROVIDERS[method.provider].destination === 'pickup-point';
      let zone;
      if (isPickup) {
        // Точку беремо лише цього способу, як і сервер (`loadPickupPoint`).
        const point = directory.pickupPoints.find(
          (p) => p.id === pickupPointId && p.method_id === methodId,
        );
        if (!point) return undefined;
        zone = resolveShippingZone(directory.zones, {
          kind: 'pickup-point',
          zoneId: point.zone_id,
        });
      } else {
        zone = resolveShippingZone(directory.zones, { kind: 'address' });
      }
      return resolveShippingRate(
        { method, zone, cart: { items: [], subtotal } },
        directory.rates,
      );
    };
  }, [
    directory.methods,
    directory.rates,
    directory.zones,
    directory.pickupPoints,
    pickupPointId,
    subtotal,
  ]);

  return { ...directory, isLoading: query.isLoading, rateFor };
}
