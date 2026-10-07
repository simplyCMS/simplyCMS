import { fromDateTimeLocal } from '../../lib/datetime-local';

/**
 * Пара дат форми впорядкована: обидві задані → початок раніше за кінець.
 * Те саме перевіряє сервер (`discount_group_dates_invalid`, refine
 * `saveDiscountInput`) — тут лише щоб власник побачив причину біля поля.
 */
export function datesOrdered(v: {
  readonly startsAt: string;
  readonly endsAt: string;
}): boolean {
  const from = fromDateTimeLocal(v.startsAt);
  const to = fromDateTimeLocal(v.endsAt);
  return !from || !to || from < to;
}

/** Межі `integer` Postgres для пріоритету. */
export const INT4 = { min: -2147483648, max: 2147483647 } as const;
