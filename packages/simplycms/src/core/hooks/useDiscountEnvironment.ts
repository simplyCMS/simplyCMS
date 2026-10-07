import { useQuery } from '@tanstack/react-query';
import type { DiscountEnvironment } from 'simplycms/contracts';
import { AGGREGATE } from 'simplycms/contracts/entities';
import { getDiscountEnvironment } from '../lib/discounts';
import { useAuth } from './useAuth';

/**
 * Середовище цін вітрини (Е6в-10) — один серверний виклик на застосунок.
 *
 * 🔴 `user?.id` у ключі — лише сегмент КЛІЄНТСЬКОГО кешу: вхід або вихід
 * без перезавантаження сторінки дає новий ключ і новий запит. Сервер актора
 * з ключа не читає — serverFn іде без аргументів, актора дає сесія.
 *
 * 🔴 `staleTime: 0`: категорію покупця змінює адмінка в ІНШОМУ браузері, і
 * інвалідація туди не дійде. Свіжість покупцю дає перезапит на кожен mount;
 * тип ціни тому й їде в цьому ж запиті — окремий кеш типу показував би стару
 * базу з новою знижкою.
 *
 * 🔴 Повертає ВЛАСНИЙ вузький об'єкт, а не результат React Query: спред
 * результату зчитує всі його поля й тим самим вимикає відстеження змін
 * (`notifyOnChangeProps`), тобто повертає зайві ререндери сітки каталогу.
 */
export function useDiscountEnvironment(): {
  data: DiscountEnvironment | undefined;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: [...AGGREGATE.discountEnvironment.key, user?.id ?? null],
    queryFn: () => getDiscountEnvironment(),
    staleTime: 0,
  });
  return { data, isLoading };
}
