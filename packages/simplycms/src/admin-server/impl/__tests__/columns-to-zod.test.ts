import { describe, expect, it } from 'vitest';
import {
  boolean,
  integer,
  interval,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { columnsToZod } from '../columns-to-zod';

const kind = pgEnum('kind', ['a', 'b']);
const t = pgTable('t', {
  u: uuid('u').notNull(),
  tx: text('tx').notNull(),
  vc: varchar('vc', { length: 3 }).notNull(),
  b: boolean('b').notNull(),
  i: integer('i').notNull(),
  ts: timestamp('ts', { mode: 'date' }).notNull(),
  n: numeric('n').notNull(),
  j: jsonb('j').notNull(),
  e: kind('e').notNull(),
  d: text('d').notNull().default('x'),
  nul: text('nul'),
  gen: text('gen').generatedAlwaysAs('1'),
});

const ok = (s: z.ZodType, v: unknown) => s.safeParse(v).success;
const sh = columnsToZod(t, 'select');

describe('columnsToZod: типи (select)', () => {
  it('uuid', () => {
    expect(ok(sh.u, crypto.randomUUID())).toBe(true);
    expect(ok(sh.u, 'nope')).toBe(false);
  });
  it('text / varchar', () => {
    expect(ok(sh.tx, 'q')).toBe(true);
    expect(ok(sh.vc, 'abc')).toBe(true);
    expect(ok(sh.vc, 'abcd')).toBe(false);
  });
  it('boolean', () => {
    expect(ok(sh.b, true)).toBe(true);
    expect(ok(sh.b, 'true')).toBe(false);
  });
  it('integer: межі int32, дробове, NaN, Infinity', () => {
    for (const v of [-2147483648, 2147483647]) expect(ok(sh.i, v)).toBe(true);
    for (const v of [2147483648, -2147483649, 1.5, NaN, Infinity]) {
      expect(ok(sh.i, v)).toBe(false);
    }
  });
  it('timestamp: лише валідна Date', () => {
    expect(ok(sh.ts, new Date())).toBe(true);
    for (const v of [new Date('x'), '2020-01-01', 1]) {
      expect(ok(sh.ts, v)).toBe(false);
    }
  });
  it('numeric (string)', () => {
    expect(ok(sh.n, '1.50')).toBe(true);
    expect(ok(sh.n, 1.5)).toBe(false);
  });
  it('jsonb', () => {
    for (const v of [{}, [], 's', 1, null]) expect(ok(sh.j, v)).toBe(true);
    expect(ok(sh.j, undefined)).toBe(false);
  });
  it('enum', () => {
    expect(ok(sh.e, 'a')).toBe(true);
    expect(ok(sh.e, 'z')).toBe(false);
  });
});

describe('columnsToZod: nullable/optional за режимами', () => {
  const ins = columnsToZod(t, 'insert');
  const upd = columnsToZod(t, 'update');
  it('insert: notNull без default обовʼязкова, з default/nullable — ні', () => {
    expect(ok(ins.tx, undefined)).toBe(false);
    expect(ok(ins.d, undefined)).toBe(true);
    expect(ok(ins.nul, undefined)).toBe(true);
    expect(ok(ins.nul, null)).toBe(true);
    expect(ok(ins.tx, null)).toBe(false);
  });
  it('update: усі optional; select: жодної', () => {
    for (const k of ['u', 'tx', 'j']) expect(ok(upd[k], undefined)).toBe(true);
    expect(ok(sh.tx, undefined)).toBe(false);
    expect(ok(sh.nul, undefined)).toBe(false);
    expect(ok(sh.nul, null)).toBe(true);
  });
  it('refine зберігає nullable/optional поверх результату', () => {
    const r = { nul: (s: z.ZodType) => (s as z.ZodString).min(2) };
    const patch = columnsToZod(t, 'update', r);
    expect(ok(patch.nul, undefined)).toBe(true);
    expect(ok(patch.nul, null)).toBe(true);
    expect(ok(patch.nul, 'a')).toBe(false);
    expect(ok(patch.nul, 'ab')).toBe(true);
  });
  it('generatedAlwaysAs відсутня в insert/update, є в select', () => {
    expect('gen' in ins).toBe(false);
    expect('gen' in upd).toBe(false);
    expect('gen' in sh).toBe(true);
  });
});

describe('columnsToZod: невідомий тип', () => {
  it('throw з імʼям таблиці, колонки й типом', () => {
    const bad = pgTable('bad_t', { iv: interval('iv') });
    expect(() => columnsToZod(bad, 'select')).toThrow(
      /PgInterval.*"bad_t\.iv"/,
    );
  });
});
