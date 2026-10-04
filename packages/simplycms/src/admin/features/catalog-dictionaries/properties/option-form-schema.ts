import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';
import type { PropertyOption } from 'simplycms/schema/types';

const optionalText = z.string().trim();

/**
 * Форма опції властивості (Е4, Task 8). slug — `SLUG_RE` (Е4-7), без
 * автогенерації з назви (легасі `generateSlug` лишав кирилицю в URL).
 * `images` — 0..1 референс сховища ↔ `imageUrl` (Е4-10).
 */
export const optionFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  sortOrder: z.coerce.number().int().min(0),
  description: optionalText,
  metaTitle: optionalText,
  metaDescription: optionalText,
  images: z.array(z.string()).max(1),
});

export type OptionFormInput = z.input<typeof optionFormSchema>;
export type OptionFormValues = z.output<typeof optionFormSchema>;

const orNull = (s: string) => (s === '' ? null : s);

/** Поля update. 🔴 Без `propertyId` — insertOnly (Е4-5). */
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
