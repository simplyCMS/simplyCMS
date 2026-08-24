import { and, asc, eq, inArray } from 'drizzle-orm';
import { propertyOptions, sectionProperties } from 'simplycms/schema';
import type { ActorDb } from './db';
import {
  optionColumns,
  propertyColumns,
  toPropertyRow,
  type OptionRow,
  type PropertyRow,
} from './entities/property';

/** Характеристика разом з її опціями — форма, яку чекає сторінка. */
export type PropertyWithOptions = PropertyRow & {
  property_options: OptionRow[];
};

/**
 * Характеристики, що мають публічну сторінку.
 *
 * 🔴 `has_page` — теж предикат видимості, не менш обовʼязковий за `is_active`
 * (пояснення моделі — у `./sections`): характеристика без сторінки не має
 * потрапляти ні в перелік, ні у відкриття за прямим посиланням.
 */
export async function loadProperties(
  db: ActorDb,
): Promise<PropertyWithOptions[]> {
  const rows = await db
    .select(propertyColumns)
    .from(sectionProperties)
    .where(eq(sectionProperties.hasPage, true))
    .orderBy(asc(sectionProperties.sortOrder), asc(sectionProperties.name));

  return withOptions(db, rows.map(toPropertyRow));
}

/** Характеристика за slug — лише така, що має сторінку. */
export async function loadPropertyBySlug(
  db: ActorDb,
  slug: string,
): Promise<PropertyWithOptions | null> {
  const [row] = await db
    .select(propertyColumns)
    .from(sectionProperties)
    .where(
      and(
        eq(sectionProperties.slug, slug),
        eq(sectionProperties.hasPage, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [withAll] = await withOptions(db, [toPropertyRow(row)]);
  return withAll;
}

/**
 * Доклеює опції одним запитом по всіх характеристиках.
 *
 * 🔴 Саме `inArray`, а не запит на характеристику: сторінка переліку показує
 * їх усі одразу, тож поділ на запити дав би рівно ту кількість раундтрипів,
 * скільки характеристик завела адмінка.
 */
async function withOptions(
  db: ActorDb,
  rows: PropertyRow[],
): Promise<PropertyWithOptions[]> {
  if (rows.length === 0) return [];

  const optionRows = await db
    .select(optionColumns)
    .from(propertyOptions)
    .where(
      inArray(
        propertyOptions.propertyId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(propertyOptions.sortOrder));

  const byProperty: Record<string, OptionRow[]> = {};
  for (const option of optionRows) {
    (byProperty[option.property_id] ??= []).push(option);
  }

  return rows.map((row) => ({
    ...row,
    property_options: byProperty[row.id] ?? [],
  }));
}
