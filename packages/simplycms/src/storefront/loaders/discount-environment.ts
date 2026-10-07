import type { DiscountEnvironment } from 'simplycms/contracts';
import { loadPricingContext } from 'simplycms/commerce';
import { withCustomerDb, withStorefrontDb, type ActorDb } from './db';

/**
 * Середовище цін вітрини — ОДНА транзакція (Е6в-10).
 *
 * 🔴 `userId` приходить лише з серверної сесії (`core/lib/discounts.ts`):
 * залогінений покупець читає профіль під власним актором, гість — під
 * публічним. Тип ціни, категорія, ліс і `now` — з одного `loadPricingContext`,
 * тобто з одного знімка БД і того самого ядра, що рахує кошик і чек.
 *
 * 🔴 Ліс — без вимкнених гілок: назви вимкнених акцій у браузер не йдуть.
 */
export function discountEnvironmentFor(
  userId: string | null,
): Promise<DiscountEnvironment> {
  const load = async (db: ActorDb): Promise<DiscountEnvironment> => {
    const ctx = await loadPricingContext(db, userId);
    return {
      forest: ctx.forest,
      actor: {
        userId: ctx.userId,
        categoryId: ctx.categoryId,
        isLoggedIn: ctx.isLoggedIn,
      },
      priceTypeId: ctx.priceTypeId,
      defaultPriceTypeId: ctx.defaultPriceTypeId,
      now: ctx.now,
    };
  };
  return userId ? withCustomerDb(userId, load) : withStorefrontDb(load);
}
