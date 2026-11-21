import { z } from 'zod';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import type { PropertyOption } from 'simplycms/schema/types';

const optionalText = z.string().trim();

/**
 * Форма опції властивості. slug — `SLUG_FORMAT`, без
 * автогенерації з назви (легасі `generateSlug` лишав кирилицю в URL).
 * `images` — 0..1 референс сховища ↔ `imageUrl`.
 */
export const optionFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_FORMAT),
  sortOrder: z.coerce.number().int().min(0),
  description: optionalText,
  metaTitle: optionalText,
  metaDescription: optionalText,
  images: z.array(z.string()).max(1),
});

export type OptionFormInput = z.input<typeof optionFormSchema>;
export type OptionFormValues = z.output<typeof optionFormSchema>;

const orNull = (s: string) => (s === '' ? null : s);

/** Поля update. 🔴 Без `propertyId` — insertOnly. */
export function toOptionPatch(v: OptionFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    sortOrder: v.sortOrder,
    description: orNull(v.description),
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    imageUrl: v.images[0] ?? null,
  } satisfies Partial<PropertyOption>;
}

export function toOptionDraft(
  v: OptionFormValues,
  id: string,
  propertyId: string,
  now: Date,
): PropertyOption {
  return { ...toOptionPatch(v), id, propertyId, createdAt: now };
}
