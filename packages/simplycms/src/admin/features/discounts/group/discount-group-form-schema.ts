import { z } from 'zod';
import { datesOrdered, INT4 } from '../date-range';
import { GROUP_OPERATORS } from '../discount-labels';

/** Службове значення select-а батька для кореневого рівня (`NULL`). */
export const ROOT_GROUP = '__root__';

/** Значення форми групи. Дати — рядки `datetime-local` (Е6в-22). */
export const discountGroupFormSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    operator: z.enum(GROUP_OPERATORS),
    parentGroupId: z.string(),
    priority: z.coerce.number().int().min(INT4.min).max(INT4.max),
    isActive: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine(datesOrdered, { path: ['endsAt'] });

export type DiscountGroupFormInput = z.input<typeof discountGroupFormSchema>;
export type DiscountGroupFormValues = z.output<typeof discountGroupFormSchema>;
