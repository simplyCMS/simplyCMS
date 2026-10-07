import { z } from 'zod';
import { parseCategoryRuleConditions } from 'simplycms/domain/user-categories';
import { INT4 } from '../../discounts/date-range';

/** Службове значення select-а «з будь-якої категорії» (`NULL`). */
export const ANY_CATEGORY = '__any__';

/**
 * Значення форми правила. Умови перевіряє той самий `parseCategoryRuleConditions`,
 * що й сервер (Е6в-19): порожній список, оператор поза переліком поля чи
 * нечислове значення числового поля не пройдуть ще на клієнті.
 */
export const categoryRuleFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  fromCategoryId: z.string(),
  toCategoryId: z.string().min(1),
  priority: z.coerce.number().int().min(INT4.min).max(INT4.max),
  isActive: z.boolean(),
  conditions: z
    .object({
      type: z.enum(['all', 'any']),
      rules: z.array(
        z.object({
          field: z.string(),
          operator: z.string(),
          value: z.string(),
        }),
      ),
    })
    .refine((c) => parseCategoryRuleConditions(c) !== null),
});

export type CategoryRuleFormInput = z.input<typeof categoryRuleFormSchema>;
export type CategoryRuleFormValues = z.output<typeof categoryRuleFormSchema>;
