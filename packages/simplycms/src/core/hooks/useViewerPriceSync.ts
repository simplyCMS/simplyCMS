import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { isViewerPricedQuery } from 'simplycms/react-query';

/** Мінімум роутера, потрібний скиданню: перезапуск лоадерів роутів. */
interface InvalidatableRouter {
  invalidate: () => Promise<unknown>;
}

/**
 * Скидає прайси попереднього глядача після входу чи виходу (Р29).
 *
 * 🔴 Спершу лоадери роутів: їхні дані — `initialData` запитів з цінами, і
 * без перезапуску комірка нового глядача народилася б із прайсом старого
 * (гуртовим — у гостя після виходу). Далі неактивні комірки видаляються, а
 * активні скидаються й перезапитуються вже з новою cookie.
 */
export async function resetViewerPrices(
  queryClient: QueryClient,
  router: InvalidatableRouter | undefined,
): Promise<void> {
  queryClient.removeQueries({
    predicate: isViewerPricedQuery,
    type: 'inactive',
  });
  await router?.invalidate();
  queryClient.removeQueries({
    predicate: isViewerPricedQuery,
    type: 'inactive',
  });
  await queryClient.resetQueries({ predicate: isViewerPricedQuery });
}

/**
 * Стежить за зміною власника сесії й кличе `resetViewerPrices`.
 *
 * 🔴 Перше розвʼязання сесії після завантаження сторінки — не вхід: SSR уже
 * рахував прайс цього глядача, тож скидати нічого. Тригер — лише перехід
 * між двома ВІДОМИМИ станами (гість ↔ покупець, покупець A → B).
 */
export function useViewerPriceSync(
  userId: string | null,
  isPending: boolean,
): void {
  const queryClient = useQueryClient();
  // Без роутера (тести, точки входу без RouterProvider) — лише кеш запитів.
  const router = useRouter({ warn: false }) as InvalidatableRouter | undefined;
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    const before = previous.current;
    previous.current = userId;
    if (before === undefined || before === userId) return;
    void resetViewerPrices(queryClient, router);
  }, [userId, isPending, queryClient, router]);
}
