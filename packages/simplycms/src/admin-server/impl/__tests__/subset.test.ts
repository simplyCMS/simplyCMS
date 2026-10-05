import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { orderStatuses, orders } from 'simplycms/schema';
import {
  subsetInputSchema,
  toDrizzleSubset,
  type SubsetInput,
} from '../subset';

const ALLOW = {
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder'],
} as const;

const dialect = new PgDialect();

describe('subset: isNull (Е3-14 — ціни/залишки рівня товару)', () => {
  it('isNull: колонка з allowlist → IS NULL без параметра', () => {
    const s = toDrizzleSubset(
      orderStatuses,
      { filterable: ['color'], sortable: [] },
      { filters: [{ field: ['color'], operator: 'isNull', value: null }] },
    );
    expect(s.where).toBeDefined();
    // 🔴 Не лише «where визначений» — САМ SQL: isNull мусить дати `is null`
    // без параметра (мутація OPERATORS.isNull → eq дала б `= $1`, мутація
    // → isNotNull дала б `is not null` — обидві ловить це асертами нижче).
    const compiled = dialect.sqlToQuery(s.where!);
    expect(compiled.sql.toLowerCase()).toContain('is null');
    expect(compiled.params).toEqual([]);
  });

  it('isNull з непорожнім value — 400 на межі (схема)', () => {
    expect(
      subsetInputSchema.safeParse({
        subset: {
          filters: [{ field: ['color'], operator: 'isNull', value: 1 }],
        },
      }).success,
    ).toBe(false);
  });
});

describe('subset: трансляція предикатів колекції у Drizzle', () => {
  it('колонка поза allowlist — кидає', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        filters: [{ field: ['name'], operator: 'eq', value: 'x' }],
      }),
    ).toThrow(/name/);
  });

  it('сортування поза allowlist — кидає', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        sorts: [{ field: ['createdAt'], direction: 'asc' }],
      }),
    ).toThrow(/createdAt/);
  });

  it('невідомий оператор — кидає, не ігнорується', () => {
    // Рантайм-негатив: 'like' поза union-типом SubsetInput, тож у strict TS
    // потрібен явний каст (рев'ю р3) — це саме те, що прийшло б із мережі
    // повз типи, і що toDrizzleSubset мусить відбити сам.
    const invalid = {
      filters: [{ field: ['code'], operator: 'like', value: 'x' }],
    } as unknown as SubsetInput;
    expect(() => toDrizzleSubset(orderStatuses, ALLOW, invalid)).toThrow(
      /like/,
    );
  });

  it('дозволене — проходить; порожнє — порожній subset', () => {
    const s = toDrizzleSubset(orderStatuses, ALLOW, {
      filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
      sorts: [{ field: ['sortOrder'], direction: 'asc' }],
      limit: 10,
    });
    expect(s.where).toBeDefined();
    expect(s.limit).toBe(10);
    expect(toDrizzleSubset(orderStatuses, ALLOW, {}).where).toBeUndefined();
  });

  it('R9: форма value привʼязана до оператора (400, не 500 з БД)', () => {
    const parse = (f: object) =>
      subsetInputSchema.safeParse({ subset: { filters: [f] } }).success;
    expect(parse({ field: ['code'], operator: 'in', value: 'x' })).toBe(false); // скаляр замість масиву
    expect(parse({ field: ['code'], operator: 'in', value: [] })).toBe(false); // порожній масив
    expect(parse({ field: ['code'], operator: 'eq', value: ['a', 'b'] })).toBe(
      false,
    ); // масив замість скаляра
    expect(parse({ field: ['code'], operator: 'in', value: ['a', 'b'] })).toBe(
      true,
    );
    expect(parse({ field: ['code'], operator: 'eq', value: null })).toBe(true);
  });

  it('напрям поза asc/desc при прямому виклику — кидає, не мовчазний asc', () => {
    expect(() =>
      toDrizzleSubset(orderStatuses, ALLOW, {
        sorts: [{ field: ['sortOrder'], direction: 'sideways' }],
      } as unknown as SubsetInput),
    ).toThrow(/напрям/);
  });

  it('allowlist з неіснуючою колонкою — чітка помилка з іменем таблиці', () => {
    expect(() =>
      toDrizzleSubset(
        orderStatuses,
        { filterable: ['colour'], sortable: [] },
        { filters: [{ field: ['colour'], operator: 'eq', value: 'x' }] },
      ),
    ).toThrow(/colour.*order_statuses/);
  });

  it('subsetInputSchema — строгий: limit обмежений, сміття не проходить', () => {
    expect(
      subsetInputSchema.safeParse({ subset: { limit: 100_000 } }).success,
    ).toBe(false);
    expect(
      subsetInputSchema.safeParse({ subset: { filters: 'x' } }).success,
    ).toBe(false);
    expect(subsetInputSchema.safeParse({}).success).toBe(true);
    expect(
      subsetInputSchema.safeParse({
        subset: {
          filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
          limit: 50,
        },
      }).success,
    ).toBe(true);
  });
});

describe('subset: Date і sortable-колонки (курсор «Показати ще», @tanstack/db 0.11.3)', () => {
  // createdAt — лише sortable (як у ресурсі замовлень); statusId — filterable.
  const CURSOR_ALLOW = {
    filterable: ['statusId'],
    sortable: ['createdAt', 'total'],
  } as const;
  const d = new Date('2026-01-01T00:00:00.123Z');
  const run = (
    operator: string,
    value: unknown,
    field = 'createdAt',
    allow: {
      filterable: readonly string[];
      sortable: readonly string[];
    } = CURSOR_ALLOW,
  ) =>
    toDrizzleSubset(orders, allow, {
      filters: [{ field: [field], operator, value }],
    } as unknown as SubsetInput);

  it('(а) gte/lt з Date по sortable-but-not-filterable колонці проходять; обидва значення — параметри', () => {
    const s = toDrizzleSubset(orders, CURSOR_ALLOW, {
      filters: [
        { field: ['createdAt'], operator: 'gte', value: d },
        {
          field: ['createdAt'],
          operator: 'lt',
          value: new Date(d.getTime() + 1),
        },
      ],
    });
    const compiled = dialect.sqlToQuery(s.where!);
    expect(compiled.sql).toMatch(/>= \$1/);
    expect(compiled.sql).toMatch(/< \$2/);
    expect(compiled.params).toHaveLength(2);
  });

  it('(б) in/isNull по sortable-but-not-filterable — кидає з іменем колонки; eq зі скаляром — проходить', () => {
    expect(() => run('in', ['a'], 'total')).toThrow(/total.*in|in.*total/);
    expect(() => run('isNull', null, 'total')).toThrow(
      /total.*isNull|isNull.*total/,
    );
    expect(() => run('eq', 5, 'total')).not.toThrow();
  });

  it('(в) gt по колонці, що ні sortable, ні filterable — кидає', () => {
    expect(() => run('gt', 1, 'subtotal')).toThrow(/subtotal/);
    expect(() => run('eq', 1, 'subtotal')).toThrow(/subtotal/);
  });

  it('(г) Invalid Date, NaN, Infinity у діапазонних операторах — відхиляє схема', () => {
    const ok = (operator: string, value: unknown) =>
      subsetInputSchema.safeParse({
        subset: { filters: [{ field: ['createdAt'], operator, value }] },
      }).success;
    for (const op of ['gt', 'gte', 'lt', 'lte']) {
      expect(ok(op, new Date(NaN))).toBe(false);
      expect(ok(op, Number.NaN)).toBe(false);
      expect(ok(op, Number.POSITIVE_INFINITY)).toBe(false);
      expect(ok(op, Number.NEGATIVE_INFINITY)).toBe(false);
      expect(ok(op, d)).toBe(true);
      expect(ok(op, 5)).toBe(true);
    }
  });

  it('(д) Date в eq/in/isNull — відхиляє схема', () => {
    const ok = (operator: string, value: unknown) =>
      subsetInputSchema.safeParse({
        subset: { filters: [{ field: ['createdAt'], operator, value }] },
      }).success;
    expect(ok('eq', d)).toBe(false);
    expect(ok('in', [d])).toBe(false);
    expect(ok('isNull', d)).toBe(false);
  });

  it('(е) колонка поза allowlist через omit (accessToken) — gt кидає, навіть якщо є sortable', () => {
    expect(() => run('gt', 'x', 'accessToken')).toThrow(/accessToken/);
    expect(() =>
      toDrizzleSubset(orders, CURSOR_ALLOW, {
        sorts: [{ field: ['accessToken'], direction: 'asc' }],
      }),
    ).toThrow(/accessToken/);
  });
});
