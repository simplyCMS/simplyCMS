import type { DiscountGroup } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  buildDiscountForest,
  type InvalidDiscountRow,
} from 'simplycms/domain/discounts';
import {
  loadCategoryPriceTypeId,
  loadDefaultUserCategoryId,
  loadUserCategoryId,
} from './categories';
import { loadDiscountRules } from './discount-rules';
import { loadDefaultPriceTypeId } from './pricing';

/** Усе, від чого залежить ціна позиції, крім самої позиції й кошика (Е6в-9). */
export interface PricingContext {
  userId: string | null;
  /** Ефективний тип ціни: тип ефективної категорії або глобальний дефолтний. */
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
 * 🔴 Категорія — персональна з відкатом на ДЕФОЛТНУ: гість і покупець без
 * категорії дістають категорію за замовчуванням, а не `null`, інакше профіль
 * без категорії випав би з роздрібної акції, у яку гість потрапляє (Е6в-19).
 * Тип ціни — тип ЦІЄЇ ефективної категорії; лише коли в ній типу немає —
 * глобальний дефолтний (F5 фінального рев'ю: одне правило для картки,
 * кошика, чеку й діагностики). Ліс — за ЕФЕКТИВНИМ типом ціни (B2 аудиту r1).
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
  const userCategoryId = userId ? await loadUserCategoryId(db, userId) : null;
  const categoryId = userCategoryId ?? (await loadDefaultUserCategoryId(db));
  const categoryPriceTypeId = categoryId
    ? await loadCategoryPriceTypeId(db, categoryId)
    : null;
  const priceTypeId = categoryPriceTypeId ?? defaultPriceTypeId;
  const rules = await loadDiscountRules(db);

  return {
    userId,
    priceTypeId,
    defaultPriceTypeId,
    categoryId,
    isLoggedIn: userId !== null,
    forest: buildDiscountForest(rules, priceTypeId, {
      includeInactive: opts?.includeInactive ?? false,
    }),
    invalidDiscounts: rules.invalid,
    now: new Date(),
  };
}
