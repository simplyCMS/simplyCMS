import { z } from 'zod';
import type { Json } from 'simplycms/contracts';
import { parseDiscountCondition } from 'simplycms/domain/discounts';
import { datesOrdered, INT4 } from '../date-range';
import { DISCOUNT_TYPES } from '../discount-labels';

/** Ціль у формі; `all` — лише єдиним елементом (Е6в-7). */
export interface FormTarget {
  readonly targetType: 'all' | 'product' | 'modification' | 'section';
  readonly targetId: string | null;
}

/** Умова у формі. `value` — JSON як є: тип і межі перевіряє реєстр (Е6в-4). */
export interface FormCondition {
  readonly conditionType: string;
  readonly operator: string;
  readonly value: unknown;
}

const target = z.custom<FormTarget>(
  (t) =>
    typeof t === 'object' &&
    t !== null &&
    ((t as FormTarget).targetType === 'all') ===
      ((t as FormTarget).targetId === null),
);

// Та сама перевірка, що в `saveDiscountInput` сервера: невідомий тип чи
// значення поза контрактом — помилка біля рядка, а не 400 після запиту.
const condition = z
  .custom<FormCondition>((c) => typeof c === 'object' && c !== null)
  .refine((c) =>
    parseDiscountCondition(c.conditionType, c.operator, c.value as Json),
  );

/**
 * Значення форми знижки. Повідомлення не тут: поле показує ключ i18n за
 * тим, ЯКЕ поле впало (патерн карток доставки).
 */
export const discountFormSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    groupId: z.string().min(1),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.coerce.number().positive(),
    priceTypeId: z.string(),
    priority: z.coerce.number().int().min(INT4.min).max(INT4.max),
    isActive: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
    targets: z
      .array(target)
      .min(1)
      .max(200)
      .refine(
        (ts) => ts.length === 1 || ts.every((t) => t.targetType !== 'all'),
      ),
    conditions: z.array(condition).max(20),
  })
  .refine((v) => v.discountType !== 'percent' || v.discountValue <= 100, {
    path: ['discountValue'],
  })
  .refine(datesOrdered, { path: ['endsAt'] });

export type DiscountFormInput = z.input<typeof discountFormSchema>;
export type DiscountFormValues = z.output<typeof discountFormSchema>;
