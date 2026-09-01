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
