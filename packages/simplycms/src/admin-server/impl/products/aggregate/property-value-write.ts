import { isForeignKeyViolation, isUniqueViolation } from 'simplycms/db';
import type { ActorDb } from 'simplycms/db';
import {
  modificationPropertyValues,
  productPropertyValues,
} from 'simplycms/schema';
import { fail } from './children-common';
import type { PropertyValuesInput } from './children-schemas';
import { scalarTaken } from './property-value-owned';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];
export type ValueTable = 'product' | 'modification';

/** Обмеження значень (Р18), чию відмову команда перекладає в доменну помилку. */
const CONSTRAINTS: Readonly<
  Record<ValueTable, { kind: string; option: string; scalar: string }>
> = {
  product: {
    kind: 'product_property_values_property_kind_fkey',
    option: 'product_property_values_option_fkey',
    scalar: 'product_property_values_scalar_key',
  },
  modification: {
    kind: 'modification_property_values_property_kind_fkey',
    option: 'modification_property_values_option_fkey',
    scalar: 'modification_property_values_scalar_key',
  },
};

/**
 * Відмова БД цього запису → помилка поля чи конфлікт; інакше `null` (летить як є).
 * Розпізнавання — лише за ІМЕНЕМ обмеження (не за `error.table`: там таблиця-посилач,
 * і будь-який інший FK тієї ж вставки дав би хибну помилку `kind`).
 */
export function valueWriteError(
  error: unknown,
  table: ValueTable,
  at: (...rest: string[]) => (string | number)[],
): Error | null {
  const c = CONSTRAINTS[table];
  if (isForeignKeyViolation(error, c.kind))
    return fail(at('kind'), 'invalid_value');
  if (isForeignKeyViolation(error, c.option))
    return fail(at('optionId'), 'invalid_value');
  // Частковий UNIQUE скаляра (І8) закриває гонку, яку передперевірка
  // `assertRowsOwned` не бачить: незакомічений рядок паралельної транзакції.
  if (isUniqueViolation(error, c.scalar)) return scalarTaken();
  return null;
}

/**
 * Рядок значення: колонки за `kind`, решта обнулені (зміна типу не лишає чужої
 * колонки). Текст живе лише в перекладі (`value_kind = 'text'`, І5).
 */
export async function writeValueRow(
  db: ActorDb,
  productId: string,
  table: ValueTable,
  u: Upsert,
  at: (...rest: string[]) => (string | number)[],
): Promise<void> {
  const row = {
    propertyId: u.propertyId,
    valueKind: u.kind,
    optionId: u.optionId ?? null,
    numericValue: u.number ?? null,
    boolValue: u.bool ?? null,
    colorValue: u.color ?? null,
  };
  try {
    if (table === 'product')
      await db
        .insert(productPropertyValues)
        .values({ id: u.id, productId, ...row })
        .onConflictDoUpdate({ target: productPropertyValues.id, set: row });
    else
      await db
        .insert(modificationPropertyValues)
        .values({ id: u.id, modificationId: u.modificationId!, ...row })
        .onConflictDoUpdate({
          target: modificationPropertyValues.id,
          set: row,
        });
  } catch (error) {
    throw valueWriteError(error, table, at) ?? error;
  }
}
