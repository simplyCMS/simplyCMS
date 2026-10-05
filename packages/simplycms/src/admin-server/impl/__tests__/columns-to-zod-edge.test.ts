import { describe, expect, it } from 'vitest';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { columnsToZod } from '../columns-to-zod';

// Доповнення до columns-to-zod.test.ts: межі, яких ще не торкались (рев'ю Task 10).
const ok = (s: z.ZodType | undefined, v: unknown) => s!.safeParse(v).success;

describe('columnsToZod: межі генератора', () => {
  it('varchar без length — звичайний string без max', () => {
    const s = columnsToZod(
      pgTable('t', { v: varchar('v').notNull() }),
      'select',
    );
    expect(ok(s.v, 'a'.repeat(10_001))).toBe(true);
    expect(ok(s.v, 1)).toBe(false);
  });
  it('text із { enum } — шлях z.enum', () => {
    const s = columnsToZod(
      pgTable('t', { k: text('k', { enum: ['a', 'b'] }).notNull() }),
      'select',
    );
    expect(ok(s.k, 'a')).toBe(true);
    expect(ok(s.k, 'z')).toBe(false);
  });
  it('insert: $defaultFn і $onUpdate роблять notNull-колонку optional', () => {
    const s = columnsToZod(
      pgTable('t', {
        a: text('a')
          .notNull()
          .$defaultFn(() => 'x'),
        b: text('b')
          .notNull()
          .$onUpdate(() => 'y'),
        c: text('c').notNull(),
      }),
      'insert',
    );
    expect(ok(s.a, undefined)).toBe(true);
    expect(ok(s.b, undefined)).toBe(true);
    expect(ok(s.c, undefined)).toBe(false);
  });
  it('timestamp mode string і numeric mode number — не підтримані (throw)', () => {
    expect(() =>
      columnsToZod(
        pgTable('ts', { c: timestamp('c', { mode: 'string' }) }),
        'select',
      ),
    ).toThrow(/PgTimestampString.*"ts\.c"/);
    expect(() =>
      columnsToZod(
        pgTable('nm', { c: numeric('c', { mode: 'number' }) }),
        'select',
      ),
    ).toThrow(/PgNumericNumber.*"nm\.c"/);
  });
  it('insert-режим для кожного типу: валідне значення проходить, null ні', () => {
    const kind = pgEnum('kind', ['a']);
    const s = columnsToZod(
      pgTable('t', {
        u: uuid('u').notNull(),
        tx: text('tx').notNull(),
        vc: varchar('vc', { length: 2 }).notNull(),
        b: boolean('b').notNull(),
        i: integer('i').notNull(),
        ts: timestamp('ts').notNull(),
        n: numeric('n').notNull(),
        j: jsonb('j').notNull(),
        e: kind('e').notNull(),
      }),
      'insert',
    );
    const good: Record<string, unknown> = {
      u: crypto.randomUUID(),
      tx: 'x',
      vc: 'ab',
      b: true,
      i: 1,
      ts: new Date(),
      n: '1',
      j: {},
      e: 'a',
    };
    for (const [k, v] of Object.entries(good)) {
      expect(ok(s[k], v), k).toBe(true);
      expect(ok(s[k], undefined), `${k} undefined`).toBe(false);
    }
    expect(ok(s.vc, 'abc')).toBe(false);
    expect(ok(s.e, 'z')).toBe(false);
  });
});
