import { useQuery } from '@tanstack/react-query';
import { getDiscountEnvironment, type DiscountActor } from '../lib/discounts';
import {
  resolveDiscount,
  type DiscountGroup,
  type DiscountContext,
  type DiscountResult,
} from 'simplycms/domain/discounts';

/** Актор до відповіді сервера: без категорії знижки просто не спрацьовують. */
const ANONYMOUS: DiscountActor = {
  userId: null,
  userCategoryId: null,
  isLoggedIn: false,
};

const NO_GROUPS: DiscountGroup[] = [];

/**
 * Правила знижок і актор — один серверний виклик на застосунок.
 *
 * 🔴 Раніше це були ДВА браузерні запити: дерево знижок через PostgREST і
 * категорія покупця запитом `profiles` за `user_id` із клієнта. Обидва зникли
 * (пояснення — у `../lib/discounts`), тож ціна на вітрині більше не залежить
 * від того, що браузер сказав про себе.
 *
 * 🔴 Ключ НЕ містить id покупця: акторa визначає cookie сесії на сервері.
 * Додати його в ключ означало б дати клієнту вибирати, чию відповідь дістати
 * з кешу.
 */
function useDiscountEnvironment() {
  return useQuery({
    queryKey: ['discount-environment'],
    queryFn: () => getDiscountEnvironment(),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Активні групи знижок для типу ціни покупця.
 *
 * 🔴 Повертає ВЛАСНИЙ вузький об'єкт, а не результат React Query: спред
 * результату зчитує всі його поля й тим самим вимикає відстеження змін
 * (`notifyOnChangeProps`), тобто повертає зайві ререндери сітки каталогу.
 */
export function useDiscountGroups(): {
  data: DiscountGroup[];
  isLoading: boolean;
} {
  const { data, isLoading } = useDiscountEnvironment();
  return { data: data?.groups ?? NO_GROUPS, isLoading };
}

/**
 * Контекст покупця для рушія знижок.
 *
 * 🔴 Повертається САМЕ поле відповіді, а не новий об'єкт: результат іде в
 * `deps` мемоїзованих прайсингів, і свіжий літерал на кожному рендері
 * перераховував би ціни всієї сітки каталогу без жодної зміни даних.
 */
export function useDiscountContext(): DiscountActor {
  const { data } = useDiscountEnvironment();
  return data?.actor ?? ANONYMOUS;
}

export type { DiscountActor };

/** Застосовує дерево знижок до однієї ціни. */
export function applyDiscount(
  basePrice: number,
  groups: DiscountGroup[],
  context: Omit<DiscountContext, 'now'>,
): DiscountResult {
  if (!groups.length || basePrice <= 0) {
    return {
      finalPrice: basePrice,
      totalDiscount: 0,
      appliedDiscounts: [],
      rejectedDiscounts: [],
    };
  }
  return resolveDiscount(basePrice, groups, { ...context, now: new Date() });
}
