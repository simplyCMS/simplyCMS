// Реєстр перекладних сутностей М1 (майстер §3.1). Єдина адреса таблиці, FK і
// переліку полів: хелпери запису/читання беруть їх звідси, а не з рядкових
// літералів операцій. М2 доповнює реєстр (розділи, властивості, опції).
import {
  TRANSLATABLE_FIELDS,
  fieldToWire,
  type TranslatableSpec,
} from 'simplycms/domain/translations';

/** Специфікація полів + де вони лежать: таблиця перекладів, її FK на сутність і таблиця-база. */
export interface TranslatableEntity extends TranslatableSpec {
  readonly table: string;
  readonly fk: string;
  /** Таблиця сутності, що має переклади: звірка гарантій (гранти, тригер) бере її. */
  readonly base: string;
}

/**
 * Поля беруться з клієнтобезпечного `TRANSLATABLE_FIELDS` (там же правила
 * іменування й `fieldToWire`); тут лише серверна адреса таблиць.
 */
export const TRANSLATABLE = {
  product: {
    ...TRANSLATABLE_FIELDS.product,
    table: 'product_translations',
    fk: 'product_id',
    base: 'products',
  },
  productModification: {
    ...TRANSLATABLE_FIELDS.productModification,
    table: 'product_modification_translations',
    fk: 'modification_id',
    base: 'product_modifications',
  },
  productImage: {
    ...TRANSLATABLE_FIELDS.productImage,
    table: 'product_image_translations',
    fk: 'image_id',
    base: 'product_images',
  },
  productPropertyValue: {
    ...TRANSLATABLE_FIELDS.productPropertyValue,
    table: 'product_property_value_translations',
    fk: 'value_id',
    base: 'product_property_values',
  },
  modificationPropertyValue: {
    ...TRANSLATABLE_FIELDS.modificationPropertyValue,
    table: 'modification_property_value_translations',
    fk: 'value_id',
    base: 'modification_property_values',
  },
} as const satisfies Record<string, TranslatableEntity>;

export type TranslatableKey = keyof typeof TRANSLATABLE;

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
