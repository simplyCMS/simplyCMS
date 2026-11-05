// Клієнтобезпечні поля перекладних сутностей (М2, Р19): що перекладається, що
// обов'язкове, що несе HTML. Окремо від `src/translations/specs.ts`, бо адмінка
// (форми, схеми) бере перелік полів відсюди, а таблиця й FK — серверна справа.
// Поля названі колонками БД (snake_case): ключі `source_hashes` (І10) — рівно ці
// імена; на дроті API вони camelCase (`fieldToWire`).
import type { TranslatableSpec } from './status';

export const TRANSLATABLE_FIELDS = {
  product: {
    fields: [
      'name',
      'short_description',
      'description',
      'meta_title',
      'meta_description',
    ],
    required: ['name'],
    richHtml: ['description'],
  },
  productModification: {
    fields: ['name'],
    required: ['name'],
  },
  productImage: {
    fields: ['alt', 'storage_key'],
    required: [],
  },
  productPropertyValue: {
    fields: ['value'],
    required: [],
  },
  modificationPropertyValue: {
    fields: ['value'],
    required: [],
  },
} as const satisfies Record<string, TranslatableSpec>;

/** `short_description` → `shortDescription`. */
export const fieldToWire = (field: string): string =>
  field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
