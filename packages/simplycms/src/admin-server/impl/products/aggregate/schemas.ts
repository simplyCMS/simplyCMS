import { z } from 'zod';
import { code } from '../../languages/view';
import { textsRowSchema } from '../../translatable/wire';

// Схеми вводу/виводу агрегата товару (М1, Task 11); перетворення й `expectedVersion` —
// спільні, `translatable/wire.ts`.

const optText = (max: number) => z.string().max(max).nullable().optional();

/** Тексти однієї мови. Невідоме поле — відмова (`strict`), а не мовчазне відкидання. */
export const productTexts = z.strictObject({
  name: optText(500),
  shortDescription: optText(5_000),
  description: optText(200_000),
  metaTitle: optText(500),
  metaDescription: optText(1_000),
});
export type ProductTexts = z.infer<typeof productTexts>;

export const textsByLocale = z.record(code, productTexts);
export const stockStatus = z.enum(['in_stock', 'out_of_stock', 'on_order']);

/** Неперекладна основа товару. */
export const productBase = z.strictObject({
  sectionId: z.uuid().nullable().optional(),
  sku: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hasModifications: z.boolean().optional(),
  stockStatus: stockStatus.optional(),
});
export type ProductBase = z.infer<typeof productBase>;

/** Рядок `texts` у `products.get`: значення полів + статуси відносно джерела. */
export const textsRow = textsRowSchema(productTexts);
export type TextsRow = z.infer<typeof textsRow>;
