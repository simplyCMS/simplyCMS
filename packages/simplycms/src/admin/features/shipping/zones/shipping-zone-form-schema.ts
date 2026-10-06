import { z } from 'zod';

/** Міста й області вводяться рядком через кому або з нового рядка → `text[]`. */
export function splitList(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Масив з БД (може бути `null`) → рядок для поля форми. */
export function joinList(list: readonly string[] | null | undefined): string {
  return (list ?? []).join(', ');
}

/** Значення форми зони. `isDefault` тут немає: дефолт ставить окрема операція. */
export const shippingZoneFormSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  cities: z.string(),
  regions: z.string(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type ShippingZoneFormInput = z.input<typeof shippingZoneFormSchema>;
export type ShippingZoneFormValues = z.output<typeof shippingZoneFormSchema>;
