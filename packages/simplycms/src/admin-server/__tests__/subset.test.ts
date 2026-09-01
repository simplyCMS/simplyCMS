import { describe, expect, it } from 'vitest';
import { orderStatuses } from 'simplycms/schema';
import {
  subsetInputSchema,
  toDrizzleSubset,
  type SubsetInput,
} from '../subset';

const ALLOW = {
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder'],
} as const;

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
    expect(parse({ field: ['code'], operator: 'in', value: 'x' })).toBe(
      false,
    ); // скаляр замість масиву
    expect(parse({ field: ['code'], operator: 'in', value: [] })).toBe(
      false,
    ); // порожній масив
    expect(
      parse({ field: ['code'], operator: 'eq', value: ['a', 'b'] }),
    ).toBe(false); // масив замість скаляра
    expect(
      parse({ field: ['code'], operator: 'in', value: ['a', 'b'] }),
    ).toBe(true);
    expect(parse({ field: ['code'], operator: 'eq', value: null })).toBe(
      true,
    );
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
