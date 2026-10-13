import { PRICE_VIEW_GUEST, PRICE_VIEW_UNRESOLVED } from 'simplycms/react-query';
import { useAuth } from './useAuth';
import { useDiscountEnvironment } from './useDiscountEnvironment';

/**
 * Вид цін глядача для ключа публічних запитів з цінами (Р29, `priceViewKey`):
 * `'guest'` — гість, id виду цін — покупець, `'unresolved'` — покупець, чий
 * вид клієнту не відомий, `null` — ще невідомо, запит чекає.
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
  const { lastKnown: env, isError } = useDiscountEnvironment();
  if (isLoading) return null;
  if (!user) return PRICE_VIEW_GUEST;
  // Останній відомий вид ЦЬОГО покупця: невдалий фоновий перезапит
  // середовища вид цін не міняє (fix round 2 рев'ю А6.3).
  if (env && env.actor.userId === user.id && env.priceTypeId)
    return env.priceTypeId;
  // 🔴 Покупець із невідомим видом — окремий сентинел, НІКОЛИ не 'guest':
  // serverFn бере вид із сесії, тож його прайс (гуртовий) ліг би в гостьову
  // комірку, а після виходу гість дістав би його першим рендером.
  if (isError || (env && env.actor.userId === user.id))
    return PRICE_VIEW_UNRESOLVED;
  return null;
}
