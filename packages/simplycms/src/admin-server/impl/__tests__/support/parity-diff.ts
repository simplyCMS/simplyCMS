import { isDeepStrictEqual } from 'node:util';
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
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
// UPSTREAM:DZOD-1 — статичний інференс drizzle-zod на generic-таблиці
// (TS2589); рантайм викликається незмінно, тут лише тип виклику.
const REFERENCE = {
  insert: createInsertSchema as unknown as RefFactory,
  update: createUpdateSchema as unknown as RefFactory,
  select: createSelectSchema as unknown as RefFactory,
} satisfies Record<SchemaMode, RefFactory>;

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
          if (a.success !== b.success) {
            diffs.push(
              `${at}: ${String(v).slice(0, 20)} -> ${a.success} vs ${b.success}`,
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
