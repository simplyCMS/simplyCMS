import type { ActorDb } from 'simplycms/db';
import {
  modificationPropertyValues,
  productPropertyValues,
} from 'simplycms/schema';
import type { PropertyValuesInput } from './children-schemas';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];
export type ValueTable = 'product' | 'modification';

/**
 * Рядок значення: колонки за `kind`, решта обнулені (зміна типу не лишає
 * чужої колонки). М1-TEMP: зноситься в Task 17 — текст основної мови дзеркалиться
 * в `value`, бо старі читачі вітрини ще беруть його звідти.
 */
export async function writeValueRow(
  db: ActorDb,
  productId: string,
  table: ValueTable,
  u: Upsert,
  primaryText: string | null | undefined,
): Promise<void> {
  const columns = {
    propertyId: u.propertyId,
    valueKind: u.kind,
    optionId: u.optionId ?? null,
    numericValue: u.number ?? null,
    boolValue: u.bool ?? null,
    colorValue: u.color ?? null,
  };
  const mirror =
    u.kind !== 'text'
      ? { value: null }
      : primaryText === undefined
        ? {}
        : { value: primaryText };
  if (table === 'product') {
    const row = { ...columns, ...mirror };
    await db
      .insert(productPropertyValues)
      .values({ id: u.id, productId, ...row })
      .onConflictDoUpdate({ target: productPropertyValues.id, set: row });
    return;
  }
  const row = { ...columns, ...mirror };
  await db
    .insert(modificationPropertyValues)
    .values({ id: u.id, modificationId: u.modificationId!, ...row })
    .onConflictDoUpdate({ target: modificationPropertyValues.id, set: row });
}
