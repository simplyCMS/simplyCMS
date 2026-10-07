// Квота кошика (К3-Е6в, Е6в-13): ціни, знижки й підказки рядків кошика,
// пораховані сервером тим самим ядром, що й чек. Тільки типи — 0 runtime.

import type { ThresholdHint } from './discount';

/** Знижка, що увійшла в ціну рядка: назва для покупця й сума на одиницю. */
export interface CartQuoteAppliedDiscount {
  name: string;
  calculatedAmount: number;
}

/** Рядок, який можна купити: ціна після знижок, база й порогові підказки. */
export interface AvailableCartQuoteLine {
  available: true;
  productId: string;
  modificationId: string | null;
  quantity: number;
  name: string;
  basePrice: number;
  price: number;
  applied: CartQuoteAppliedDiscount[];
  hints: ThresholdHint[];
}

/**
 * Рядок, якого купити не можна (товар зник, вимкнений, без ціни чи залишку).
 * 🔴 Квоту він не валить: кошик показує «недоступний», решта рахується.
 */
export interface UnavailableCartQuoteLine {
  available: false;
  productId: string;
  modificationId: string | null;
  quantity: number;
}

export type CartQuoteLine = AvailableCartQuoteLine | UnavailableCartQuoteLine;

/**
 * Відповідь `quoteCart`. `subtotal` — Σ `price × quantity` ДОСТУПНИХ рядків,
 * складена цілими центами; рядки — у порядку запиту.
 */
export interface CartQuote {
  lines: CartQuoteLine[];
  subtotal: number;
}
