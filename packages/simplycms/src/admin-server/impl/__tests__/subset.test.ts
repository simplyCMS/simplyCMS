import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { priceTypes } from 'simplycms/schema';
import { toDrizzleSubset, type SubsetInput } from '../subset';

const ALLOW = {
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder'],
} as const;
const dialect = new PgDialect();
const bad = (x: object) => x as unknown as SubsetInput;

describe('toDrizzleSubset: allowlist і оператори', () => {
  it('isNull: колонка з allowlist → IS NULL без параметра', () => {
    const s = toDrizzleSubset(
      priceTypes,
      { filterable: ['code'], sortable: [] },
      { filters: [{ field: ['code'], operator: 'isNull', value: null }] },
    );
    // 🔴 САМ SQL: мутація isNull → eq дала б `= $1`, → isNotNull `is not null`.
    const compiled = dialect.sqlToQuery(s.where!);
    expect(compiled.sql.toLowerCase()).toContain('is null');
    expect(compiled.params).toEqual([]);
  });

  it('колонка / сортування поза allowlist — кидає', () => {
    expect(() =>
      toDrizzleSubset(priceTypes, ALLOW, {
        filters: [{ field: ['name'], operator: 'eq', value: 'x' }],
      }),
    ).toThrow(/name/);
    expect(() =>
      toDrizzleSubset(priceTypes, ALLOW, {
        sorts: [{ field: ['createdAt'], direction: 'asc' }],
      }),
    ).toThrow(/createdAt/);
  });

  it('невідомий оператор і напрям — кидає, не ігнорується', () => {
    expect(() =>
      toDrizzleSubset(
        priceTypes,
        ALLOW,
        bad({ filters: [{ field: ['code'], operator: 'like', value: 'x' }] }),
      ),
    ).toThrow(/like/);
    expect(() =>
      toDrizzleSubset(
        priceTypes,
        ALLOW,
        bad({ sorts: [{ field: ['sortOrder'], direction: 'sideways' }] }),
      ),
    ).toThrow(/напрям/);
  });

  it('дозволене — проходить; порожнє — порожній subset', () => {
    const s = toDrizzleSubset(priceTypes, ALLOW, {
      filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
      sorts: [{ field: ['sortOrder'], direction: 'asc' }],
      limit: 10,
    });
    expect(s.where).toBeDefined();
    expect(s.limit).toBe(10);
    expect(toDrizzleSubset(priceTypes, ALLOW, {}).where).toBeUndefined();
  });

  it('allowlist з неіснуючою колонкою — чітка помилка з іменем таблиці', () => {
    expect(() =>
      toDrizzleSubset(
        priceTypes,
        { filterable: ['colour'], sortable: [] },
        { filters: [{ field: ['colour'], operator: 'eq', value: 'x' }] },
      ),
    ).toThrow(/colour.*price_types/);
  });
});
