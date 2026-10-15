import { z } from 'zod';

/** Значення форми зони. `isDefault` тут немає: дефолт ставить окрема операція. */
export const shippingZoneFormSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type ShippingZoneFormInput = z.input<typeof shippingZoneFormSchema>;
export type ShippingZoneFormValues = z.output<typeof shippingZoneFormSchema>;
