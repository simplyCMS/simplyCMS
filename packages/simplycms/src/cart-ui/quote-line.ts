import type { CartQuote, CartQuoteLine } from 'simplycms/contracts';

type LineIdentity = { productId: string; modificationId: string | null };

/**
 * Рядок квоти для позиції кошика — за парою товар/модифікація.
 *
 * `null` — квоти ще немає або вона порахована для попереднього складу
 * кошика (позицію щойно додали): рядок показує скелет, а не вигадану ціну.
 */
export function findQuoteLine(
  quote: CartQuote | null,
  item: LineIdentity,
): CartQuoteLine | null {
  return (
    quote?.lines.find(
      (line) =>
        line.productId === item.productId &&
        line.modificationId === item.modificationId,
    ) ?? null
  );
}

/**
 * Чи лежить у кошику позиція, яку квота назвала недоступною (Е6в-13).
 *
 * 🔴 Рахується по ПОЗИЦІЯХ кошика, а не по рядках квоти: щойно покупець
 * прибрав недоступний товар, оформлення розблоковується одразу, ще до
 * нової квоти (попередня квота лишається placeholder'ом до відповіді).
 */
export function hasUnavailableItem(
  quote: CartQuote | null,
  items: readonly LineIdentity[],
): boolean {
  return items.some((item) => findQuoteLine(quote, item)?.available === false);
}
