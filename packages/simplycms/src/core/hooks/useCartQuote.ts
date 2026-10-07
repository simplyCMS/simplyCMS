import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CartQuote } from 'simplycms/contracts';
import { AGGREGATE } from 'simplycms/contracts/entities';
import { useCart } from 'simplycms/react-query';
import { quoteCart } from '../lib/cart-quote';
import { useAuth } from './useAuth';

const EMPTY_QUOTE: CartQuote = { lines: [], subtotal: 0 };

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
 * `keepPreviousData`: на «+»/«−» показується попередня ВНУТРІШНЬО узгоджена
 * квота, доки не прийде нова, а не скелет на кожен клік.
 */
export function useCartQuote(): {
  quote: CartQuote | null;
  isLoading: boolean;
} {
  const { items, hydrated } = useCart();
  const { user } = useAuth();
  const lines = items.map(({ productId, modificationId, quantity }) => ({
    productId,
    modificationId,
    quantity,
  }));
  const enabled = hydrated && lines.length > 0;
  const { data, isLoading } = useQuery({
    queryKey: [
      ...AGGREGATE.cartQuote.key,
      user?.id ?? null,
      lines.map((l) => [l.productId, l.modificationId, l.quantity]),
    ],
    queryFn: () => quoteCart({ data: { items: lines } }),
    staleTime: 0,
    enabled,
    placeholderData: keepPreviousData,
  });

  if (!hydrated) return { quote: null, isLoading: true };
  if (lines.length === 0) return { quote: EMPTY_QUOTE, isLoading: false };
  return { quote: data ?? null, isLoading };
}
