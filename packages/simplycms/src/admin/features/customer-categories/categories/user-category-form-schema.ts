import { z } from 'zod';

/** Службове значення select-а типу ціни для «за замовчуванням» (`NULL`). */
export const NO_PRICE_TYPE = '__none__';

/** Значення форми категорії. `isDefault` тут немає: дефолт ставить кнопка списку. */
export const userCategoryFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
  description: z.string().max(2000),
  priceTypeId: z.string(),
});

export type UserCategoryFormInput = z.input<typeof userCategoryFormSchema>;
export type UserCategoryFormValues = z.output<typeof userCategoryFormSchema>;
