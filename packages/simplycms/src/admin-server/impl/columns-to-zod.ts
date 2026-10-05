import { getTableColumns, getTableName, is } from 'drizzle-orm';
import type { Column, Table } from 'drizzle-orm';
import {
  PgBoolean,
  PgInteger,
  PgJsonb,
  PgNumeric,
  PgText,
  PgTimestamp,
  PgUUID,
  PgVarchar,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

export type SchemaMode = 'insert' | 'update' | 'select';

// Дзеркало drizzle-zod 0.8.3 (index.mjs, рр. 33-38): та сама форма union.
const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonSchema = z.union([
  literalSchema,
  z.record(z.string(), z.any()),
  z.array(z.any()),
]);

/**
 * Базова схема однієї колонки за класом Drizzle (`is`, не зіставлення
 * рядків). Дзеркало drizzle-zod 0.8.3 `columnToSchema` (рр. 40-105):
 * enum — першим (р. 44), далі `stringColumnToSchema` (uuid, varchar.max —
 * рр. 197-237), `numberColumnToSchema` (PgInteger int32 — рр. 137-146, 186),
 * boolean/date/json. Режими `string`/`number` timestamp і numeric — окремі
 * класи Drizzle, тож `is(…, PgTimestamp)` = лише mode date. Невідомий тип —
 * throw: drizzle-zod тут мовчки дає `z.any()` (р. 102), а ми не пускаємо
 * неперевірене значення в запис.
 */
export function columnSchema(column: Column): z.ZodType {
  if ('enumValues' in column && Array.isArray(column.enumValues)) {
    if (column.enumValues.length > 0) return z.enum(column.enumValues);
  }
  if (is(column, PgUUID)) return z.uuid();
  if (is(column, PgVarchar)) {
    return column.length ? z.string().max(column.length) : z.string();
  }
  if (is(column, PgText) || is(column, PgNumeric)) return z.string();
  if (is(column, PgBoolean)) return z.boolean();
  if (is(column, PgInteger)) return z.int().gte(-2147483648).lte(2147483647);
  if (is(column, PgTimestamp)) return z.date();
  if (is(column, PgJsonb)) return jsonSchema;
  throw new Error(
    `[admin-server] columnsToZod: тип колонки ${column.columnType} ` +
      `("${getTableName(column.table)}.${column.name}") не підтримано`,
  );
}

/** «Завжди згенерована» колонка — у insert/update її немає (`never` у drizzle-zod, рр. 286, 291). */
function isGeneratedAlways(column: Column): boolean {
  return (
    column.generated?.type === 'always' ||
    column.generatedIdentity?.type === 'always'
  );
}

/** Умова `optional` за режимом (drizzle-zod рр. 280-294). */
function isOptional(column: Column, mode: SchemaMode): boolean {
  if (mode === 'select') return false;
  if (mode === 'update') return true;
  return !column.notNull || column.hasDefault;
}

/**
 * Форма (shape) схем колонок таблиці за режимом. `refine` — ФУНКЦІЇ над
 * БАЗОВОЮ схемою колонки; `nullable`/`optional` навішуються ПОВЕРХ її
 * результату (drizzle-zod рр. 258-271), тож refine їх не губить.
 */
export function columnsToZod(
  table: Table,
  mode: SchemaMode,
  refine: Record<string, (schema: never) => z.ZodType> = {},
): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, column] of Object.entries(getTableColumns(table))) {
    if (mode !== 'select' && isGeneratedAlways(column)) continue;
    const base = columnSchema(column);
    const refiner = refine[key];
    // `refine` типізований `(schema: never) => …` (контракт ResourceRefine,
    // бо схема колонки статично невідома) — єдиний точковий каст виклику.
    let schema = refiner ? refiner(base as never) : base;
    if (!column.notNull) schema = schema.nullable();
    if (isOptional(column, mode)) schema = schema.optional();
    shape[key] = schema;
  }
  return shape;
}
