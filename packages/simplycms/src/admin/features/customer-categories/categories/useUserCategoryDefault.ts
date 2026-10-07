import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateDiscountConsumers,
  useCollection,
  userCategoriesCollection,
} from 'simplycms/admin-data';
import { setDefaultUserCategory } from 'simplycms/admin-server';
import { invalidateCustomerCounts } from './useCategoryCustomerCounts';

/**
 * Призначення дефолтної категорії: іменована операція міняє два рядки й
 * повертає їх — write-back без refetch. Дефолтна категорія визначає, куди
 * потрапляють профілі без категорії, тож лічильники покупців і ціни
 * вітрини (середовище знижок) скидаються тут, після write-back.
 */
export function useUserCategoryDefault(): (id: string) => Promise<void> {
  const categories = useCollection(userCategoriesCollection);
  const queryClient = useQueryClient();
  return async (id) => {
    const { rows } = await setDefaultUserCategory({ data: { id } });
    categories.utils.writeBatch(() => {
      for (const row of rows) categories.utils.writeUpsert(row);
    });
    await Promise.all([
      invalidateCustomerCounts(queryClient),
      invalidateDiscountConsumers(queryClient),
    ]);
  };
}
