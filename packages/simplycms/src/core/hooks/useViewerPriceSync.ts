import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  isViewerPricedQuery,
  PRICE_VIEW_UNRESOLVED,
} from 'simplycms/react-query';

/** Мінімум роутера, потрібний скиданню: перезапуск лоадерів роутів. */
interface InvalidatableRouter {
  invalidate: () => Promise<unknown>;
}

/**
 * Скидає прайси попереднього глядача після входу чи виходу (Р29).
 *
 * 🔴 Спершу лоадери роутів: їхні дані — `initialData` запитів з цінами, і
 * без перезапуску комірка нового глядача народилася б із прайсом старого
 * (гуртовим — у гостя після виходу). `onLoadersFresh` — мить, коли дані
 * лоадерів знову належать поточному глядачу. Далі неактивні комірки
 * видаляються, а активні скидаються й перезапитуються вже з новою cookie.
 *
 * 🔴 Комірки `'unresolved'` — ОДРАЗУ й незалежно від активності: сегмент
 * спільний для всіх покупців із невідомим видом, тож при прямій зміні сесії
 * A → B (вхід за запрошенням поверх чинної сесії) B, щойно його вид теж стане
 * невідомим, прочитав би ще живу комірку A на час `router.invalidate()`.
 */
export async function resetViewerPrices(
  queryClient: QueryClient,
  router: InvalidatableRouter | undefined,
  onLoadersFresh: () => void = () => {},
): Promise<void> {
  queryClient.removeQueries({
    predicate: (query) =>
      isViewerPricedQuery(query) && query.queryKey[1] === PRICE_VIEW_UNRESOLVED,
  });
  queryClient.removeQueries({
    predicate: isViewerPricedQuery,
    type: 'inactive',
  });
  await router?.invalidate();
  onLoadersFresh();
  queryClient.removeQueries({
    predicate: isViewerPricedQuery,
    type: 'inactive',
  });
  await queryClient.resetQueries({ predicate: isViewerPricedQuery });
}

/**
 * Чи належать дані лоадерів роутів ПОТОЧНОМУ глядачу (M4 рев'ю А6.3).
 * Без провайдера — так (тести, точки входу без `AuthProvider`).
 */
export const ViewerLoaderFreshContext = createContext(true);

/**
 * `initialData` з лоадера роуту — лише поки лоадер рахував ЦЬОГО глядача.
 *
 * 🔴 У рендері, де сесія вже змінилась, а `router.invalidate()` ще в дорозі,
 * дані лоадера — прайс попереднього глядача (гуртовий після виходу). Засіяна
 * ними нова комірка показала б його гостю; без засіву вона просто
 * запитується з новою cookie.
 */
export function useSeedableInitialData<T>(data: T | undefined): T | undefined {
  return useContext(ViewerLoaderFreshContext) ? data : undefined;
}

/**
 * Стежить за зміною власника сесії й кличе `resetViewerPrices`. Повертає,
 * чи дані лоадерів роутів належать поточному глядачу (`ViewerLoaderFreshContext`).
 *
 * 🔴 Перше розвʼязання сесії після завантаження сторінки — не вхід: SSR уже
 * рахував прайс цього глядача, тож скидати нічого. Тригер — лише перехід
 * між двома ВІДОМИМИ станами (гість ↔ покупець, покупець A → B).
 */
export function useViewerPriceSync(
  userId: string | null,
  isPending: boolean,
): boolean {
  const queryClient = useQueryClient();
  // Без роутера (тести, точки входу без RouterProvider) — лише кеш запитів.
  const router = useRouter({ warn: false }) as InvalidatableRouter | undefined;
  const previous = useRef<string | null | undefined>(undefined);
  // Для кого рахували лоадери роутів; `undefined` — сесія ще не розвʼязана
  // (SSR і перший рендер: лоадер рахував сесію запиту, тобто цього глядача).
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>();

  useEffect(() => {
    if (isPending) return;
    const before = previous.current;
    previous.current = userId;
    if (before === undefined) {
      setLoadedFor(userId);
      return;
    }
    if (before === userId) return;
    void resetViewerPrices(queryClient, router, () => setLoadedFor(userId));
  }, [userId, isPending, queryClient, router]);

  // Синхронно в рендері: ефект запізнився б на кадр, у якому нова комірка
  // вже засіяна б даними попереднього глядача.
  return isPending || loadedFor === undefined || loadedFor === userId;
}
