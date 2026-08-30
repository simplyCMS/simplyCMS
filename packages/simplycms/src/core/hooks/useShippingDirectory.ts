import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AGGREGATE } from 'simplycms/contracts/entities';
import {
  findShippingZoneIn,
  resolveShippingRate,
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
 * 🔴 Розрахунок НЕ живе тут: `resolveShippingRate` і `findShippingZoneIn` —
 * доменні (T1) функції, і саме вони єдине джерело правила. До В2-К1а форма
 * чекауту мала власну копію («перший тариф методу, `free_from` — нуль понад
 * поріг»), тобто ціна в списку способів і ціна в підсумку рахувалися різним
 * кодом і могли розійтися.
 *
 * 🔴 Зона резолвиться з МІСТА покупця — раніше форма зон не читала взагалі й
 * брала перший-ліпший тариф методу незалежно від напрямку.
 */
export function useShippingDirectory(city: string, subtotal: number) {
  const query = useQuery({
    queryKey: AGGREGATE.shippingDirectory.key,
    queryFn: (): Promise<ShippingDirectory> => getShippingDirectory(),
    staleTime: 5 * 60 * 1000,
  });

  const directory = query.data ?? EMPTY;
  const zone = useMemo(
    () => findShippingZoneIn(directory.zones, city),
    [directory.zones, city],
  );

  const rateFor = useMemo(() => {
    const byId = new Map(directory.methods.map((m) => [m.id, m]));
    return (methodId: string): ShippingCalculationResult | null => {
      const method = byId.get(methodId);
      if (!method) return null;
      return resolveShippingRate(
        { method, zone, cart: { items: [], subtotal } },
        directory.rates,
      );
    };
  }, [directory.methods, directory.rates, zone, subtotal]);

  return { ...directory, isLoading: query.isLoading, rateFor };
}
