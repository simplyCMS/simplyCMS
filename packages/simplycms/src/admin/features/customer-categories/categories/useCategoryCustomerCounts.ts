import { useQuery, type QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { countCustomersByCategory } from 'simplycms/admin-server';

/** Ключ лічильників покупців: варіант сутності, а не ключ колекції. */
export const CUSTOMER_COUNTS_KEY = entityKey(ENTITY.userCategories).variant(
  'customer-counts',
);

/**
 * Кількість покупців за категорією. Профілі без категорії сервер уже
 * зарахував у дефолтну (Е6в-19), тож клієнт лише розкладає відповідь за id.
 */
export function useCategoryCustomerCounts(): ReadonlyMap<string, number> {
  // cache-sync-ok: це читання (queryFn), а не мутація
  const { data } = useQuery({
    queryKey: CUSTOMER_COUNTS_KEY,
    queryFn: () => countCustomersByCategory(),
  });
  return new Map((data ?? []).map((c) => [c.categoryId, c.customers]));
}

/** Скидає лічильники: змінились категорії покупців (дефолт, запуск правил). */
export const invalidateCustomerCounts = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: CUSTOMER_COUNTS_KEY });
