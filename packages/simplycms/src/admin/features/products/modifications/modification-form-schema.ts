import { z } from 'zod';
import { SLUG_RE } from '../edit/product-form-schema';

/** Значення форми модифікації (Task 8, Step 3). Slug — той самий регекс, що в товару (Task 7). */
export const modificationFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  sku: z.string().trim(),
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']),
  isDefault: z.boolean(),
  images: z.array(z.string()),
});
export type ModificationFormValues = z.infer<typeof modificationFormSchema>;
