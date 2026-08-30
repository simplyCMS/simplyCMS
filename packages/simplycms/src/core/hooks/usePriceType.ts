import { useQuery } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { getPriceTypeContext } from '../lib/price-type';
import { useAuth } from './useAuth';

/**
 * 🔴 Контекст читає ДВІ таблиці (`price_types` + `user_categories`), але
 * `price_types` лишається якорем ключа: саме вона задає дефолт, який бачить
 * кожен відвідувач, а персональний тип — похідна поверх нього для
 * конкретного покупця (сегмент `user?.id`).
 */
const priceTypes = entityKey(ENTITY.priceTypes);

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
    queryKey: [...priceTypes.list(), 'context', user?.id ?? null],
    queryFn: () => getPriceTypeContext(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    priceTypeId: data?.priceTypeId ?? null,
    defaultPriceTypeId: data?.defaultPriceTypeId ?? null,
  };
}
