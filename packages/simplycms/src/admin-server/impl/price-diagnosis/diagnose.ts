import type { z } from 'zod';
import type { AppliedDiscount, RejectedDiscount } from 'simplycms/contracts';
import { loadPricingContext, priceCart } from 'simplycms/commerce';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { diagnosePriceInput } from './input';

/** Пояснення ціни однієї позиції (Е6в-6): що застосоване, що й чому ні. */
export type PriceDiagnosis = {
  priceTypeId: string | null;
  categoryId: string | null;
  available: boolean;
  basePrice: number | null;
  finalPrice: number | null;
  applied: AppliedDiscount[];
  rejected: RejectedDiscount[];
};

/**
 * Діагностика ціни (`discount.manage`) — ТЕ САМЕ ядро, що й чекаут:
 * `loadPricingContext` + `priceCart`. Окремого розрахунку тут немає, тож
 * пояснення не може розійтись із реальною ціною.
 *
 * 🔴 `includeInactive: true` — ЛИШЕ тут (Е6в-8): вимкнені знижки й групи
 * лишаються в лісі, рушій відхиляє їх з причиною `inactive`/`group_inactive`,
 * а ціна від цього не змінюється. Пошкоджені рядки (Е6в-25) ядро виключає з
 * лісу — дописуємо їх у `rejected` як `discount_invalid`.
 */
export const diagnosePriceOp = async ({
  data,
}: {
  data: z.infer<typeof diagnosePriceInput>;
}): Promise<PriceDiagnosis> => {
  const input = parseAdminInput(diagnosePriceInput, data);
  return runAdmin('discount.manage', async (db) => {
    const ctx = await loadPricingContext(db, input.userId, {
      includeInactive: true,
    });
    const { lines } = await priceCart(
      db,
      ctx,
      [
        {
          productId: input.productId,
          modificationId: input.modificationId,
          quantity: input.quantity,
        },
      ],
      { extraCartTotal: input.otherCartTotal },
    );
    const line = lines[0]!;
    const invalid: RejectedDiscount[] = ctx.invalidDiscounts.map((row) => ({
      id: row.id,
      name: row.name,
      groupName: row.groupName ?? '',
      reason: 'discount_invalid',
      conditionType: null,
    }));
    const base = {
      priceTypeId: ctx.priceTypeId,
      categoryId: ctx.categoryId,
    };
    if (!line.available)
      return {
        ...base,
        available: false,
        basePrice: null,
        finalPrice: null,
        applied: [],
        rejected: invalid,
      };
    return {
      ...base,
      available: true,
      basePrice: line.basePrice,
      finalPrice: line.price,
      applied: line.applied,
      rejected: [...line.rejected, ...invalid],
    };
  });
};
