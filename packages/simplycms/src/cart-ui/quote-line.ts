import type { CartQuote, CartQuoteLine } from 'simplycms/contracts';

/**
 * Рядок квоти для позиції кошика — за парою товар/модифікація.
 *
 * `null` — квоти ще немає або вона порахована для попереднього складу
 * кошика (позицію щойно додали): рядок показує скелет, а не вигадану ціну.
 */
export function findQuoteLine(
  quote: CartQuote | null,
  item: { productId: string; modificationId: string | null },
): CartQuoteLine | null {
  return (
    quote?.lines.find(
      (line) =>
        line.productId === item.productId &&
        line.modificationId === item.modificationId,
    ) ?? null
  );
}
