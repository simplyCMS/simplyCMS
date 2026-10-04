/**
 * Коди системних статусів замовлення — контракт між даними й кодом (Е5-5).
 *
 * T0: рядки, нуль залежностей. Код статусу — зв'язок між рядком довідника
 * `order_statuses` і логікою вітрини та адмінки: скасування покупцем шукає
 * статус за `cancelled`, а кнопка «Скасувати» живе лише для `new`. Два місця
 * з рядковими літералами розійшлися б мовчки, тож літерали є тут один раз.
 *
 * 🔴 Ці коди незмінні (`order_statuses.code` — `insertOnly`) і системні
 * статуси не видаляються (Е5-6): від них залежить скасування замовлення.
 */
export const ORDER_STATUS_CODE = {
  new: 'new',
  cancelled: 'cancelled',
} as const;

/** Код системного статусу замовлення. */
export type OrderStatusCode =
  (typeof ORDER_STATUS_CODE)[keyof typeof ORDER_STATUS_CODE];

/** Усі системні коди — для перевірки «чи це системний статус». */
export const SYSTEM_ORDER_STATUS_CODES: readonly string[] =
  Object.values(ORDER_STATUS_CODE);
