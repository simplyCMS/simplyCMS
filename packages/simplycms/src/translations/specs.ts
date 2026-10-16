// Реєстр перекладних сутностей М1 (майстер §3.1). Єдина адреса таблиці, FK і
// переліку полів: хелпери запису/читання беруть їх звідси, а не з рядкових
// літералів операцій. М2 доповнює реєстр (розділи, властивості, опції).
import type { TranslatableSpec } from 'simplycms/domain/translations';

/** Специфікація полів + де вони лежать: таблиця перекладів і її FK на сутність. */
export interface TranslatableEntity extends TranslatableSpec {
  readonly table: string;
  readonly fk: string;
}

/**
 * Поля названі колонками БД (snake_case): ключі `source_hashes` (І10) — рівно
 * ці імена. На дроті API поля camelCase (`fieldToWire`), як і решта вхідних
 * схем ядра.
 */
export const TRANSLATABLE = {
  product: {
    table: 'product_translations',
    fk: 'product_id',
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
    table: 'product_modification_translations',
    fk: 'modification_id',
    fields: ['name'],
    required: ['name'],
  },
  productImage: {
    table: 'product_image_translations',
    fk: 'image_id',
    fields: ['alt', 'storage_key'],
    required: [],
  },
  productPropertyValue: {
    table: 'product_property_value_translations',
    fk: 'value_id',
    fields: ['value'],
    required: [],
  },
  modificationPropertyValue: {
    table: 'modification_property_value_translations',
    fk: 'value_id',
    fields: ['value'],
    required: [],
  },
} as const satisfies Record<string, TranslatableEntity>;

export type TranslatableKey = keyof typeof TRANSLATABLE;

/** `short_description` → `shortDescription`. */
export const fieldToWire = (field: string): string =>
  field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** `shortDescription` → поле специфікації; `null`, якщо такого поля немає. */
export function fieldFromWire(
  spec: TranslatableSpec,
  name: string,
): string | null {
  return spec.fields.find((f) => fieldToWire(f) === name) ?? null;
}

// Ідентифікатори йдуть у SQL через `sql.raw`: лише з реєстру, але рубіж
// не зайвий — помилка в реєстрі не має стати ін'єкцією.
const IDENT = /^[a-z][a-z0-9_]*$/;
export function assertIdent(name: string): string {
  if (!IDENT.test(name))
    throw new Error(
      `[simplycms/translations] недопустимий ідентифікатор «${name}»`,
    );
  return name;
}
