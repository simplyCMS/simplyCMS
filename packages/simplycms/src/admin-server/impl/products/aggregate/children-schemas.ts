import { z } from 'zod';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import { code } from '../../languages/view';

// Схеми дочірніх колекцій агрегата товару (М1, Task 12). Усі strict: невідоме
// поле — відмова, а не мовчазне відкидання. Колекції ніколи не видаляються
// неявно — лише явним `remove`.

const optText = (max: number) => z.string().max(max).nullable().optional();
const idList = z.array(z.uuid()).max(500).optional();

/** Тип властивості (`property_type`): тип значення мусить збігатися з ним. */
export const PROPERTY_KINDS = [
  'text',
  'number',
  'select',
  'multiselect',
  'range',
  'color',
  'boolean',
] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const modificationUpsert = z.strictObject({
  id: z.uuid(),
  sku: optText(100),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  texts: z.record(code, z.strictObject({ name: optText(500) })).optional(),
  /** Явний токен за мовою; без нього нова модифікація бере токен від назви. */
  token: z.record(code, z.string().max(255).regex(SLUG_FORMAT)).optional(),
});
export const modificationsInput = z.strictObject({
  upsert: z.array(modificationUpsert).max(500).optional(),
  remove: idList,
});
export type ModificationsInput = z.infer<typeof modificationsInput>;

export const propertyValueUpsert = z.strictObject({
  id: z.uuid(),
  propertyId: z.uuid(),
  kind: z.enum(PROPERTY_KINDS),
  optionId: z.uuid().optional(),
  /** Десятковий рядок `numeric(15,4)`. */
  number: z
    .string()
    .regex(/^-?\d{1,11}(\.\d{1,4})?$/)
    .optional(),
  bool: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/)
    .optional(),
  /** Лише для `kind = 'text'`: текст за мовами. */
  text: z.record(code, z.string().max(5_000).nullable()).optional(),
  /** Значення модифікації; без нього — значення самого товару. */
  modificationId: z.uuid().optional(),
});
export const propertyValuesInput = z.strictObject({
  upsert: z.array(propertyValueUpsert).max(1_000).optional(),
  remove: idList,
});
export type PropertyValuesInput = z.infer<typeof propertyValuesInput>;

export const imageUpsert = z.strictObject({
  id: z.uuid(),
  /** Файл ЦЬОГО товару (рядок `media` із `entity_type = 'product'`). */
  storageKey: z.string().min(1).max(500),
  sortOrder: z.number().int().min(0).max(1_000_000),
  modificationId: z.uuid().optional(),
  alt: z.record(code, z.string().max(1_000).nullable()).optional(),
  /** Мовний варіант файлу; для основної мови файл — сам `storageKey`. */
  overrides: z.record(code, z.string().min(1).max(500).nullable()).optional(),
});
export const imagesInput = z.strictObject({
  upsert: z.array(imageUpsert).max(500).optional(),
  remove: idList,
});
export type ImagesInput = z.infer<typeof imagesInput>;
