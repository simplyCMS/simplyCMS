import { useQuery } from '@tanstack/react-query';
import { getPriceTypeContext } from '../lib/price-type';
import { useAuth } from './useAuth';

/**
 * Контекст цін покупця: тип за замовчуванням і персональний тип категорії.
 *
 * 🔴 Один серверний виклик замість двох запитів браузера — і персональний
 * тип більше не резолвиться за `user_id`, присланим із клієнта (пояснення —
 * у `../lib/price-type`).
 */
export function usePriceType() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['price-type-context', user?.id ?? null],
    queryFn: () => getPriceTypeContext(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    priceTypeId: data?.priceTypeId ?? null,
    defaultPriceTypeId: data?.defaultPriceTypeId ?? null,
  };
}
