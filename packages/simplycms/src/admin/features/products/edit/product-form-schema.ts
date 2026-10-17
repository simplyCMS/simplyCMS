import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';

// Формат адреси живе в T1 (`simplycms/domain`); реекспорт лишено, щоб не
// правити наявних споживачів.
export { SLUG_RE };

/** Поля, що перекладаються (`products.saveDescription`.texts.<мова>). */
export const TEXT_FIELDS = [
  'name',
  'shortDescription',
  'description',
  'metaTitle',
  'metaDescription',
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type DraftTexts = Record<TextField, string>;

export const PROPERTY_KINDS = [
  'text',
  'number',
  'select',
  'multiselect',
  'range',
  'color',
  'boolean',
] as const;

const stockStatus = z.enum(['in_stock', 'out_of_stock', 'on_order']);
const perLocale = <T extends z.ZodType>(v: T) => z.record(z.string(), v);

const draftTexts = z.object({
  name: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export const draftModification = z.object({
  id: z.uuid(),
  sku: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  stockStatus,
  /** Назва за мовою. */
  texts: perLocale(z.string()),
  /** Токен за мовою (порожній — не задано). */
  token: perLocale(z.string()),
});
export type DraftModification = z.infer<typeof draftModification>;

export const draftValue = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  kind: z.enum(PROPERTY_KINDS),
  optionId: z.uuid().optional(),
  number: z.string().optional(),
  bool: z.boolean().optional(),
  color: z.string().optional(),
  text: perLocale(z.string().nullable()).optional(),
  modificationId: z.uuid().optional(),
});
export type DraftValue = z.infer<typeof draftValue>;

export const draftImage = z.object({
  id: z.uuid(),
  storageKey: z.string(),
  sortOrder: z.number().int(),
  modificationId: z.uuid().optional(),
  alt: perLocale(z.string().nullable()),
  overrides: perLocale(z.string()),
});
export type DraftImage = z.infer<typeof draftImage>;

/**
 * Значення форми картки. Тексти — за мовами (вкладки); дочірні колекції
 * агрегата живуть тут же, тож усе йде ОДНИМ `saveDescription`. `path` — лише
 * для створення (адреса основної мови), далі її править `PathField`.
 */
export const productFormSchema = z.object({
  sectionId: z.string(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  hasModifications: z.boolean(),
  sku: z.string().trim(),
  stockStatus,
  path: z.string().trim(),
  texts: perLocale(draftTexts),
  modifications: z.array(draftModification),
  propertyValues: z.array(draftValue),
  images: z.array(draftImage),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Схема з вимогою: назва основною мовою (І4) і, якщо задано, формат адреси.
 * Фабрика, бо основну мову знає лише завантажений набір мов.
 */
export function productFormSchemaFor(primary: string) {
  return productFormSchema.superRefine((v, ctx) => {
    if (!v.texts[primary]?.name.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['texts', primary, 'name'],
        message: 'name',
      });
    if (v.path !== '' && !SLUG_RE.test(v.path))
      ctx.addIssue({ code: 'custom', path: ['path'], message: 'path' });
  });
}
