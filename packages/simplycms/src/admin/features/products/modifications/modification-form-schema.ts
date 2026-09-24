import { z } from 'zod';
import { SLUG_RE } from '../edit/product-form-schema';

/**
 * Значення форми модифікації (Task 8, Step 3). Slug — той самий регекс,
 * що в товару (Task 7).
 *
 * 🔴 `stockStatus` — `optional()` (рев'ю C6, item 1): поле потрібне ЛИШЕ
 * на шляху СТВОРЕННЯ (`useModifications.create`, `ModificationStatusControl`
 * пише в `form` живого рядка ще нема). При РЕДАГУВАННІ живий рядок уже є —
 * статус іде окремим миттєвим `mods.update` над ним
 * (`ModificationStatusControl`), а `toModificationFormValues` (edit-шлях)
 * НЕ кладе `stockStatus` у defaultValues, щоб не лишати мертве поле форми.
 */
export const modificationFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  sku: z.string().trim(),
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']).optional(),
  isDefault: z.boolean(),
  images: z.array(z.string()),
});
export type ModificationFormValues = z.infer<typeof modificationFormSchema>;
