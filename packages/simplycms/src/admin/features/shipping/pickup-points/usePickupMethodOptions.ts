import { useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { shippingMethodsCollection, useCollection } from 'simplycms/admin-data';
import {
  SHIPPING_PROVIDERS,
  isShippingProviderId,
} from 'simplycms/contracts/shipping-providers';
import type { SelectOption } from '../methods/SelectField';

/**
 * Опції select-а способу точки: лише способи, чий провайдер везе до точки
 * (`destination === 'pickup-point'`, Е6а-12) — адресний спосіб точці не
 * належить, сервер однаково відмовив би `pickup_point_method_invalid`.
 */
export function usePickupMethodOptions(): SelectOption[] {
  const collection = useCollection(shippingMethodsCollection);
  const { data: methods } = useLiveQuery({
    query: (q) =>
      q.from({ m: collection }).orderBy(({ m }) => m.sortOrder, 'asc'),
  });
  return useMemo(
    () =>
      methods
        .filter(
          (m) =>
            isShippingProviderId(m.provider) &&
            SHIPPING_PROVIDERS[m.provider].destination === 'pickup-point',
        )
        .map((m) => ({ value: m.id, text: m.name })),
    [methods],
  );
}
