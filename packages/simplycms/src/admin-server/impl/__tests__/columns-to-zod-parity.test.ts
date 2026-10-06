// 🔴 Постійний гейт паритету `columnsToZod` з еталоном drizzle-zod 0.8.3.
// Він доводить рантайм-еквівалентність columnsToZod ≡ drizzle-zod (оракул)
// для всіх колонок ресурсних таблиць; відповідність ОГОЛОШЕНОГО типу
// (InferInsertModel/InferSelectModel) рантайм-формі — лише опосередковано
// (оракул і тип Drizzle виводять optional/nullable за тими самими правилами
// колонки). Не покрито: колонки з `$type<>` (jsonb — оголошений тип вужчий
// за рантайм-валідацію) і результати refine проти типу колонки; їх стережуть
// expectTypeOf і рев'ю. Таблиці беруться з реальних конфігів ресурсів
// (збирач нижче підміняє `defineAdminResource`) — нова таблиця автоматично в гейті.
import { describe, expect, it, vi } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
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
// Е6а: + `PgArray` (`shipping_zones.cities/regions`, text[]) — десятий тип.
const TYPES = [
  'PgArray',
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
  it('10 типів колонок у ресурсних таблицях і жодного невідомого', () => {
    const types = [...new Set(columns.map((c) => c.columnType))].sort();
    expect(types).toEqual([...TYPES].sort());
    expect(() => columns.forEach((c) => columnSchema(c))).not.toThrow();
    expect(resources.length).toBeGreaterThan(0);
  });

  it('усі виклики defineAdminResource у admin-server потрапили в гейт', () => {
    // Сирі джерела всіх не-тестових .ts: ресурс поза `impl/*/resource{,s}.ts`
    // інакше мовчки ухилився б від гейта.
    const sources = import.meta.glob(
      ['../../**/*.ts', '!../../**/__tests__/**'],
      { query: '?raw', import: 'default', eager: true },
    ) as Record<string, string>;
    const calls = Object.values(sources)
      .flatMap((src) => src.split('\n'))
      .filter(
        (l) => /defineAdminResource\(/.test(l) && !/^\s*(\/\/|\*)/.test(l),
      );
    expect(captured.length).toBe(calls.length);
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
      // Тема 12: виняток numeric не послаблює гейт — повернення до
      // drizzle-zod-поведінки (`z.string()`) тепер ЧЕРВОНІЄ.
      'm5 numeric: без формату': mutate('PgNumeric', () => z.string()),
    };
    const byName = new Map<string, Column>(
      resources.flatMap((r) =>
        Object.entries(getTableColumns(r.table)).map(
          ([k, c]) => [`${getTableName(r.table)}.${k}`, c] as const,
        ),
      ),
    );
    /** Предикат: до яких колонок мутація має право чіпатись. */
    const scope: Record<string, (c: Column) => boolean> = {
      'm1 integer: int -> number': (c) => c.columnType === 'PgInteger',
      'm2 select: без nullable': (c) => !c.notNull,
      'm3 varchar: без max': (c) => c.columnType === 'PgVarchar',
      'm4 timestamp: date -> any': (c) => c.columnType === 'PgTimestamp',
      'm5 numeric: без формату': (c) => c.columnType === 'PgNumeric',
    };
    it('контроль ідентичності: незмінений генератор — порожній diff', () => {
      const identity: Gen = (t, m, r) => ({ ...columnsToZod(t, m, r) });
      expect(diffAgainstReference(resources, identity)).toEqual([]);
    });
    for (const [name, gen] of Object.entries(mutations)) {
      it(`${name}: непорожній diff лише по колонках мутованого типу`, () => {
        const diff = diffAgainstReference(resources, gen);
        expect(diff.length).toBeGreaterThan(0);
        for (const line of diff) {
          const col = byName.get(line.split(' [')[0]!);
          expect(col && scope[name]!(col), line).toBe(true);
        }
      });
    }
  });
});
