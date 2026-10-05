// 🔴 Постійний гейт паритету `columnsToZod` з еталоном drizzle-zod 0.8.3.
// Це ЄДИНИЙ механізм, що ловить розбіжність між оголошеними типами
// (`InferInsertModel`/`InferSelectModel` з Drizzle-схеми) і РУНТАЙМ-формою
// zod-схем: компілятор бачить лише типи, а форму валідації знає тільки
// прогін значень. Таблиці беруться з реальних конфігів ресурсів (збирач
// нижче підміняє `defineAdminResource`), тож нова таблиця автоматично в гейті.
import { describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import type { Column } from 'drizzle-orm';
import { z } from 'zod';
import { columnSchema, columnsToZod } from '../columns-to-zod';
import type { SchemaMode } from '../columns-to-zod';
import { diffAgainstReference } from './support/parity-diff';
import type { ParityResource } from './support/parity-diff';

const captured = vi.hoisted(() => [] as ParityResource[]);
vi.mock('../resource', () => ({
  defineAdminResource: (config: ParityResource) => {
    captured.push(config);
    return {};
  },
}));
await Promise.all(
  Object.values(import.meta.glob('../*/resource{,s}.ts')).map((load) => load()),
);

const resources = [
  ...new Map(captured.map((r) => [getTableColumns(r.table), r])).values(),
];
const columns = resources.flatMap((r) =>
  Object.values(getTableColumns(r.table)),
);
const NINE = [
  'PgUUID',
  'PgText',
  'PgVarchar',
  'PgBoolean',
  'PgInteger',
  'PgTimestamp',
  'PgNumeric',
  'PgJsonb',
  'PgEnumColumn',
];

describe('паритет columnsToZod з drizzle-zod', () => {
  it('9 типів колонок у ресурсних таблицях і жодного невідомого', () => {
    const types = [...new Set(columns.map((c) => c.columnType))].sort();
    expect(types).toEqual([...NINE].sort());
    expect(() => columns.forEach((c) => columnSchema(c))).not.toThrow();
    expect(resources.length).toBeGreaterThan(0);
  });

  it('columnsToZod збігається з drizzle-zod: усі колонки × insert/update/select × VALUES', () => {
    expect(diffAgainstReference(resources, columnsToZod)).toEqual([]);
  });

  describe('мутаційний контроль: гейт здатен червоніти', () => {
    type Gen = typeof columnsToZod;
    /** Обгортка над генератором: підміняє базову схему колонок певного типу. */
    const mutate =
      (type: string, make: (c: Column, mode: SchemaMode) => z.ZodType): Gen =>
      (table, mode, refine) => {
        const shape = columnsToZod(table, mode, refine);
        for (const [k, col] of Object.entries(getTableColumns(table))) {
          if (col.columnType !== type || !shape[k]) continue;
          let s = make(col, mode);
          if (!col.notNull) s = s.nullable();
          if (
            mode === 'update' ||
            (mode === 'insert' && (!col.notNull || col.hasDefault))
          )
            s = s.optional();
          shape[k] = s;
        }
        return shape;
      };
    /** m2: у select колонки без notNull втрачають `.nullable()`. */
    const dropNullable: Gen = (table, mode, refine) => {
      const shape = columnsToZod(table, mode, refine);
      if (mode !== 'select') return shape;
      for (const [k, col] of Object.entries(getTableColumns(table))) {
        if (!col.notNull) shape[k] = columnSchema(col);
      }
      return shape;
    };
    const mutations: Record<string, Gen> = {
      'm1 integer: int -> number': mutate('PgInteger', () => z.number()),
      'm2 select: без nullable': dropNullable,
      'm3 varchar: без max': mutate('PgVarchar', () => z.string()),
      'm4 timestamp: date -> any': mutate('PgTimestamp', () => z.any()),
    };
    for (const [name, gen] of Object.entries(mutations)) {
      it(`${name}: непорожній diff`, () => {
        const n = diffAgainstReference(resources, gen).length;
        expect(n).toBeGreaterThan(0);
      });
    }
  });
});
