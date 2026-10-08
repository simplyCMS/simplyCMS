import { useInfiniteQuery } from '@tanstack/react-query';
import { listCustomers } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { AdminCustomerCursor } from 'simplycms/contracts/objects';

export interface CustomersFilters {
  readonly search?: string;
  readonly categoryId?: string;
  readonly role?: 'admin' | 'customer';
  readonly banned?: boolean;
}

/** Ключ списку: варіант `profiles` (ENTITY — імена таблиць) + фільтри. */
export const CUSTOMERS_LIST_KEY = entityKey(ENTITY.profiles).variant(
  'admin-customers',
);

/**
 * Список покупців без колекцій (Е6г-6): keyset-курсор від сервера, зміна
 * фільтра — новий ключ, тож сторінки й курсор скидаються самі. Розмір
 * сторінки задає сервер.
 */
export function useCustomersList(filters: CustomersFilters) {
  return useInfiniteQuery({
    queryKey: [...CUSTOMERS_LIST_KEY, filters],
    initialPageParam: undefined as AdminCustomerCursor | undefined,
    queryFn: ({ pageParam }) =>
      listCustomers({ data: { ...filters, cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
