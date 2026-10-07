import { useQuery } from '@tanstack/react-query';
import type { CartQuote } from 'simplycms/contracts';
import { AGGREGATE } from 'simplycms/contracts/entities';
import { useCart } from 'simplycms/react-query';
import { quoteCart } from '../lib/cart-quote';
import { useAuth } from './useAuth';

const EMPTY_QUOTE: CartQuote = { lines: [], subtotal: 0 };

/** Стан квоти кошика для drawer'а, сторінки кошика й чекауту. */
export interface CartQuoteState {
  /** Квота; `null` — ще немає або запит упав (`isError`). */
  quote: CartQuote | null;
  isLoading: boolean;
  /** Запит упав (мережа/500): показати помилку з повтором, а не скелет. */
  isError: boolean;
  /** Іде запит (зокрема поверх placeholder-квоти). */
  isFetching: boolean;
  /** `quote` — попередня квота ТОГО САМОГО актора, нова ще в дорозі. */
  isPlaceholderData: boolean;
  refetch: () => void;
}

/**
 * Серверна квота кошика (Е6в-13) — ЄДИНЕ джерело цін, знижок, підказок і
 * суми кошика: drawer, сторінка кошика, `CartSummary` і чекаут читають її.
 *
 * 🔴 Ключ — `userId` і трійки позицій: вхід/вихід або зміна кількості дають
 * новий ключ і новий запит (Review Focus 2). `userId` — лише сегмент
 * клієнтського кешу: актора сервер бере з сесії.
 *
 * 🔴 `staleTime: 0`: категорію покупця й акції змінює адмінка в ІНШОМУ
 * браузері, і інвалідація туди не дійде — свіжість дає перезапит.
 *
 * 🔴 Запит — лише після гідратації кошика: до неї `items` завжди порожні, і
 * квота порожнього кошика показала б 0 там, де сума ще невідома. Порожній
 * кошик після гідратації — нульова квота без мережі.
 *
 * Placeholder: на «+»/«−» показується попередня ВНУТРІШНЬО узгоджена квота,
 * а не скелет на кожен клік — але лише для ТОГО САМОГО `userId`. Після
 * входу/виходу числа попереднього актора (інша категорія — інші ціни) не
 * доходять ні до кошика, ні до `indicativeSubtotal`, ні до слотів.
 */
export function useCartQuote(): CartQuoteState {
  const { items, hydrated } = useCart();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lines = items.map(({ productId, modificationId, quantity }) => ({
    productId,
    modificationId,
    quantity,
  }));
  const query = useQuery({
    queryKey: [
      ...AGGREGATE.cartQuote.key,
      userId,
      lines.map((l) => [l.productId, l.modificationId, l.quantity]),
    ],
    queryFn: () => quoteCart({ data: { items: lines } }),
    staleTime: 0,
    enabled: hydrated && lines.length > 0,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userId ? previous : undefined,
  });
  const refetch = () => void query.refetch();
  const idle = { isError: false, isFetching: false, isPlaceholderData: false };

  if (!hydrated) return { quote: null, isLoading: true, ...idle, refetch };
  if (lines.length === 0)
    return { quote: EMPTY_QUOTE, isLoading: false, ...idle, refetch };
  return {
    // Збій — без квоти: застарілі числа поруч із помилкою вводили б в оману.
    quote: query.isError ? null : (query.data ?? null),
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    refetch,
  };
}
