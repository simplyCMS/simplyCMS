import type { DiscountGroup } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  buildDiscountForest,
  type InvalidDiscountRow,
} from 'simplycms/domain/discounts';
import {
  loadDefaultUserCategoryId,
  loadUserCategoryId,
  loadUserPriceTypeId,
} from './categories';
import { loadDiscountRules } from './discount-rules';
import { loadDefaultPriceTypeId } from './pricing';

/** Усе, від чого залежить ціна позиції, крім самої позиції й кошика (Е6в-9). */
export interface PricingContext {
  userId: string | null;
  /** Ефективний тип ціни: персональний або дефолтний. */
  priceTypeId: string | null;
  defaultPriceTypeId: string | null;
  /** Ефективна категорія: персональна або дефолтна. */
  categoryId: string | null;
  isLoggedIn: boolean;
  forest: DiscountGroup[];
  /** Виключені пошкоджені рядки (Е6в-25): лише для діагностики, не для браузера. */
  invalidDiscounts: InvalidDiscountRow[];
  now: Date;
}

/**
 * ОДИН контекст ціноутворення для картки, кошика, чекауту й адмінки.
 *
 * 🔴 Тип ціни й категорія — персональні з відкатом на ДЕФОЛТНІ: гість і
 * покупець без категорії дістають категорію за замовчуванням, а не `null`,
 * інакше профіль без категорії випав би з роздрібної акції, у яку гість
 * потрапляє. Ліс — за ЕФЕКТИВНИМ типом ціни (B2 аудиту r1).
 *
 * 🔴 `now` береться ОДИН раз на весь розрахунок: межа акції в секунду
 * оформлення не має дати різні ціни двом позиціям одного кошика.
 *
 * `includeInactive: true` — лише діагностика ціни в адмінці (Е6в-8).
 */
export async function loadPricingContext(
  db: ActorDb,
  userId: string | null,
  opts?: { includeInactive?: boolean },
): Promise<PricingContext> {
  const defaultPriceTypeId = await loadDefaultPriceTypeId(db);
  const defaultCategoryId = await loadDefaultUserCategoryId(db);
  const userPriceTypeId = userId ? await loadUserPriceTypeId(db, userId) : null;
  const userCategoryId = userId ? await loadUserCategoryId(db, userId) : null;
  const priceTypeId = userPriceTypeId ?? defaultPriceTypeId;
  const rules = await loadDiscountRules(db);

  return {
    userId,
    priceTypeId,
    defaultPriceTypeId,
    categoryId: userCategoryId ?? defaultCategoryId,
    isLoggedIn: userId !== null,
    forest: buildDiscountForest(rules, priceTypeId, {
      includeInactive: opts?.includeInactive ?? false,
    }),
    invalidDiscounts: rules.invalid,
    now: new Date(),
  };
}
