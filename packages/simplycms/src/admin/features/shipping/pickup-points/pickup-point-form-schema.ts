import { z } from 'zod';

/** Сентинел «без зони»: Radix Select не приймає порожній `value`. */
export const NO_ZONE = 'none';

/**
 * Значення форми точки видачі. `methodId` — `insertOnly` (Е6а-12): обирається
 * лише при створенні, у patch update його немає. `workingHours`/`coordinates`
 * поза обсягом Е6а.
 */
export const pickupPointFormSchema = z.object({
  methodId: z.string().min(1),
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  address: z.string().trim().min(1),
  phone: z.string().trim(),
  zoneId: z.string(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type PickupPointFormInput = z.input<typeof pickupPointFormSchema>;
export type PickupPointFormValues = z.output<typeof pickupPointFormSchema>;
