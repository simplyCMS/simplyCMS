import { isDeepStrictEqual } from 'node:util';
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { Column, Table } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import type { z } from 'zod';
import type { columnsToZod, SchemaMode } from '../../columns-to-zod';
import { valuesFor } from './parity-values';

export interface ParityResource {
  table: Table;
  refine?: Record<string, (schema: never) => z.ZodType>;
}

type Shaped = { shape: Record<string, z.ZodType> };
type RefFactory = (t: Table, r?: ParityResource['refine']) => Shaped;
// Каст існує через типізацію тестового ЕТАЛОНА drizzle-zod (DZOD-1, закрито для
// продакшену — реєстр обходів; тут лише оракул):
// його `createXSchema` виводить форму зі generic-таблиці (TS2589/TS2349),
// тож `Table` + refine-функції статично не проходять. Рантайм-виклик
// незмінний, каст лише звужує тип виклику до `RefFactory`.
const REFERENCE = {
  insert: createInsertSchema as unknown as RefFactory,
  update: createUpdateSchema as unknown as RefFactory,
  select: createSelectSchema as unknown as RefFactory,
} satisfies Record<SchemaMode, RefFactory>;

/**
 * 🔴 ДОКУМЕНТОВАНИЙ ВИНЯТОК із паритету (Тема 12): `numeric`. Еталон
 * drizzle-zod дає `z.string()` — приймає `'abc'`, що в БД падає 22P02 (500).
 * Наш `columnsToZod` свідомо суворіший: десятковий формат за
 * precision/scale колонки. Гейт НЕ послаблено — для numeric очікування
 * інше, але вичерпне: `ours = еталон І (не рядок АБО рядок вміщається у
 * numeric(p, s))`. «Вміщається» тут — НЕЗАЛЕЖНА реалізація (розбір за
 * крапкою, без того регексу, що в продакшн-коді), тож розбіжність двох
 * реалізацій теж червоніє. Для всіх інших типів — лише суворий паритет.
 */
export function numericFits(column: Column, value: string): boolean {
  const { precision, scale } = column as unknown as {
    precision: number | null;
    scale: number | null;
  };
  const unsigned = value.replace(/^[+-]/, '');
  const [int = '', frac = '', ...rest] = unsigned.split('.');
  if (rest.length > 0 || (int === '' && frac === '')) return false;
  if (!/^\d*$/.test(int) || !/^\d*$/.test(frac)) return false;
  if (precision == null) return true;
  const s = scale ?? 0;
  return int.replace(/^0+/, '').length <= precision - s && frac.length <= s;
}

function expectedSuccess(
  column: Column,
  value: unknown,
  referenceSuccess: boolean,
): boolean {
  if (column.columnType !== 'PgNumeric' || !referenceSuccess) {
    return referenceSuccess;
  }
  return typeof value !== 'string' || numericFits(column, value);
}

export const MODES: readonly SchemaMode[] = ['insert', 'update', 'select'];

/**
 * Для кожної (таблиця, режим, колонка, значення) порівнює успіх parse і, при
 * успіху, результат `data`. Порожній масив = паритет. 🔴 Невідомий тип у
 * `generate` кидає виняток — навмисно НЕ обробляється: інвентар-тест гарантує,
 * що в ресурсних таблицях невідомих типів немає (drizzle-zod там дав би
 * `z.any()`, ми — throw).
 */
export function diffAgainstReference(
  resources: readonly ParityResource[],
  generate: typeof columnsToZod,
): string[] {
  const diffs: string[] = [];
  for (const { table, refine } of resources) {
    const cols = getTableColumns(table);
    for (const mode of MODES) {
      const ref = REFERENCE[mode](table, refine).shape;
      const ours = generate(table, mode, refine);
      const keys = new Set([...Object.keys(ref), ...Object.keys(ours)]);
      for (const key of keys) {
        const at = `${getTableName(table)}.${key} [${mode}]`;
        if (!ref[key] || !ours[key]) {
          diffs.push(`${at}: ключ лише в одній зі схем`);
          continue;
        }
        for (const v of valuesFor(cols[key]!)) {
          const a = ours[key].safeParse(v);
          const b = ref[key].safeParse(v);
          const expected = expectedSuccess(cols[key]!, v, b.success);
          if (a.success !== expected) {
            diffs.push(
              `${at}: ${String(v).slice(0, 20)} -> ${a.success} vs ${expected}`,
            );
          } else if (
            a.success &&
            b.success &&
            !isDeepStrictEqual(a.data, b.data)
          ) {
            diffs.push(`${at}: data розходиться для ${String(v).slice(0, 20)}`);
          }
        }
      }
    }
  }
  return diffs;
}
