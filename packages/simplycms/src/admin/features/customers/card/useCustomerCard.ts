import { useQuery } from '@tanstack/react-query';
import { getCustomerCard } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

/** Ключ картки: варіант `profiles` (ENTITY — імена таблиць) + id покупця (Е6г-6). */
export const customerCardKey = (userId: string) =>
  entityKey(ENTITY.profiles).variant('admin-customer', userId);

/**
 * Картка покупця на серверному читанні (без колекцій). `null` з сервера —
 * «не знайдено»; збій запиту — окремий стан `isError` (Е6в F1), а не нулі.
 */
export function useCustomerCard(userId: string) {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: customerCardKey(userId),
    queryFn: () => getCustomerCard({ data: { userId } }),
  });
}
