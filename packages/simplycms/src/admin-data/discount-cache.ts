import type { QueryClient } from '@tanstack/react-query';
import { AGGREGATE } from 'simplycms/contracts/entities';

/**
 * Скидає середовище цін і квоти кошика в QueryClient АДМІНА — превʼю для
 * самого адміна, який у тій самій вкладці бачить вітринні картки (КАНОН,
 * Е6в-10). Іншим клієнтам (покупцям) це не допомагає: свіжість їм дає
 * `staleTime: 0` запитів вітрини, а не ця інвалідація.
 *
 * 🔴 Ключі — префікси `AGGREGATE.*.key` навмисно: варіанти несуть `userId`
 * (`[...discountEnvironment.key, userId]`) і ціле кошика
 * (`[...cartQuote.key, …]`). Ключі самих колекцій адмінки тут НЕ
 * інвалідуються: refetch скасував би їхній write-back (К3-7).
 * Кличеться з `afterWrite` чотирьох колекцій і з хуків іменованих операцій
 * (`saveDiscount`, `setDefaultUserCategory`, `removeUserCategories`,
 * `runCategoryRules`).
 */
export async function invalidateDiscountConsumers(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: AGGREGATE.discountEnvironment.key,
    }),
    queryClient.invalidateQueries({ queryKey: AGGREGATE.cartQuote.key }),
  ]);
}
