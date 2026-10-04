import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';
import type { Section } from 'simplycms/schema/types';

const optionalText = z.string().trim();

/**
 * Значення форми картки розділу (Е4, Task 7). Формат slug — спільна
 * константа T1 (`SLUG_RE`), яку перевіряє й сервер (Е4-7). `images` —
 * 0..1 РЕФЕРЕНС сховища (↔ `imageUrl`, Е4-10).
 */
export const sectionFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  description: optionalText,
  metaTitle: optionalText,
  metaDescription: optionalText,
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  images: z.array(z.string()).max(1),
});

/** Вхід форми до coerce (поле `number` в DOM — рядок). */
export type SectionFormInput = z.input<typeof sectionFormSchema>;
export type SectionFormValues = z.output<typeof sectionFormSchema>;

const orNull = (s: string) => (s === '' ? null : s);

/** Поля запису з форми; порожній необовʼязковий текст → `null`. */
export function toSectionPatch(v: SectionFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    description: orNull(v.description),
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    sortOrder: v.sortOrder,
    isActive: v.isActive,
    imageUrl: v.images[0] ?? null,
  } satisfies Partial<Section>;
}

/**
 * Повний оптимістичний рядок для `collection.insert`. 🔴 `parentId` завжди
 * `null`: розділи плоскі (Е4-3), колонка readonly для колекції.
 */
export function toSectionDraft(
  v: SectionFormValues,
  id: string,
  now: Date,
): Section {
  return {
    ...toSectionPatch(v),
    id,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
}
