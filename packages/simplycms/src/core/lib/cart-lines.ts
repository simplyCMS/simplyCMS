import { z } from 'zod';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from 'simplycms/contracts/cart-limits';

/**
 * Позиції кошика на серверній межі — ОДНА схема для квоти кошика
 * (`quoteCart`) і оформлення (`checkoutInputSchema`), Е6в-13.
 *
 * 🔴 Межі ті самі, що тримає кошик у браузері (`react-query/cart-normalize`):
 * чекаут, що приймає більше за кошик, рахує те, чого покупець не бачив, а
 * квота без межі — довільно великий кошик на кожен перезапит.
 *
 * 🔴 Дубль пари `(productId, modificationId)` — помилка, а не «склеїти»:
 * кошик дублів не тримає (`cart-normalize`), тож дубль у запиті — підробка
 * або дефект, і мовчки складати кількості означало б обійти межу рядка.
 *
 * Модуль без серверних імпортів і без serverFn: схему читає й валідатор
 * `storefront-routes/server/checkout-input.ts` (T5 може брати з `core`).
 */
export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  modificationId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

/** Ідентичність рядка — пара, як і в кошику. */
const hasUniquePairs = (lines: readonly z.infer<typeof cartLineSchema>[]) =>
  new Set(lines.map((l) => `${l.productId}:${l.modificationId ?? ''}`)).size ===
  lines.length;

/** Список позицій: до `MAX_CART_LINES`, без дублів пари. Порожній — валідний. */
export const cartLinesSchema = z
  .array(cartLineSchema)
  .max(MAX_CART_LINES)
  .refine(hasUniquePairs, { message: 'duplicate_cart_line' });

/** Вхід `quoteCart`. */
export const quoteCartInputSchema = z.object({ items: cartLinesSchema });
