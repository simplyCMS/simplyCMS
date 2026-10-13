import { PRICE_VIEW_GUEST } from 'simplycms/react-query';
import { useAuth } from './useAuth';
import { useDiscountEnvironment } from './useDiscountEnvironment';

/**
 * Вид цін глядача для ключа публічних запитів з цінами (Р29, `priceViewKey`):
 * `'guest'` — гість, id виду цін — покупець, `null` — ще невідомо.
 *
 * 🔴 Не `userId`: комірку кешу визначає те, що сервер поклав у payload, а він
 * фільтрує за ВИДОМ цін (`loadViewerPriceTypes`). Вид покупця бере середовище
 * цін — той самий серверний розрахунок, що й ціна картки.
 *
 * 🔴 Поки сесія чи середовище нового актора в дорозі — `null`, а не `'guest'`:
 * інакше дані залогіненого (SSR чи перший запит із його cookie) лягли б у
 * гостьову комірку. Середовище іншого актора (ключ із `userId`) теж не
 * рахується — воно ще з попередньої сесії.
 */
export function useViewerPriceKey(): string | null {
  const { user, isLoading } = useAuth();
  const { data: env } = useDiscountEnvironment();
  if (isLoading) return null;
  if (!user) return PRICE_VIEW_GUEST;
  if (!env || env.actor.userId !== user.id) return null;
  // Покупець без жодного виду цін бачить рівно гостьовий набір.
  return env.priceTypeId ?? PRICE_VIEW_GUEST;
}
