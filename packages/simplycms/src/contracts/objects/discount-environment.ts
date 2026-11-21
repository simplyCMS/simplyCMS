// Середовище цін вітрини: усе, від чого залежить ціна
// картки, крім самої позиції. Тільки типи — 0 runtime-залежностей.

import type { DiscountGroup } from './discount';

/** Хто питає ціну: категорія вже з відкатом на дефолтну. */
export interface DiscountActor {
  userId: string | null;
  categoryId: string | null;
  isLoggedIn: boolean;
}

/**
 * Відповідь ОДНІЄЇ серверної транзакції: ліс знижок (без вимкнених гілок),
 * актор, тип ціни й серверний `now`.
 *
 * 🔴 Тип ціни їде разом із лісом: база картки й знижка мусять походити з
 * одного знімка. Окремий запит типу ціни з власним кешем показував би після
 * зміни категорії стару базу з новою знижкою.
 *
 * 🔴 `now` — час сервера в момент запиту: межа акції на картці рахується за
 * ним, а не за годинником браузера.
 */
export interface DiscountEnvironment {
  forest: DiscountGroup[];
  actor: DiscountActor;
  /** Ефективний тип ціни: персональний або дефолтний. */
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
  now: Date;
}
