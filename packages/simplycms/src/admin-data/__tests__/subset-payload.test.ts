import { describe, expect, it } from 'vitest';
import { and, eq, gt, IR, inArray } from '@tanstack/react-db';
import { toSubsetPayload } from '../subset-payload';

// Вирази будуються тими самі функціями, що й у useLiveQuery. Посилання на
// поле — сконструйований IR.PropRef: з @tanstack/db 0.11.3 `toExpression`
// визнає виразами лише екземпляри IR, літерал `{type:'ref'}` — уже значення
// (db/src/query/builder/ref-proxy.ts). Форма (з аліасом чи без) — предмет
// контрактного тесту on-demand-contract, тут лише мапінг.
const ref = (field: string) =>
  new IR.PropRef([field]) as unknown as Parameters<typeof eq>[0];

describe('toSubsetPayload', () => {
  it('без опцій — порожній payload (eager-сумісність)', () => {
    expect(toSubsetPayload(undefined)).toEqual({});
  });

  it('фільтри eq/in під and, сорт, limit і offset (offset бібліотека губить — ми ні)', () => {
    const payload = toSubsetPayload({
      where: and(
        eq(ref('sectionId'), 's1'),
        inArray(ref('stockStatus'), ['in_stock', 'on_order']),
      ),
      orderBy: [
        {
          expression: ref('createdAt'),
          compareOptions: { direction: 'desc', nulls: 'last' },
        },
      ] as never,
      limit: 51,
      offset: 50,
    });
    expect(payload).toEqual({
      subset: {
        filters: [
          { field: ['sectionId'], operator: 'eq', value: 's1' },
          {
            field: ['stockStatus'],
            operator: 'in',
            value: ['in_stock', 'on_order'],
          },
        ],
        sorts: [{ field: ['createdAt'], direction: 'desc' }],
        limit: 51,
        offset: 50,
      },
    });
  });

  it('offset 0 не передається (перша сторінка = без offset)', () => {
    expect(toSubsetPayload({ limit: 10, offset: 0 })).toEqual({
      subset: { filters: [], sorts: [], limit: 10 },
    });
  });

  it('isNull проходить з явним value: null (рівень товару = modification_id IS NULL)', () => {
    expect(
      toSubsetPayload({
        where: {
          type: 'func',
          name: 'isNull',
          args: [ref('modificationId')],
        } as never,
      }).subset?.filters,
    ).toEqual([{ field: ['modificationId'], operator: 'isNull', value: null }]);
  });

  it('оператор поза контрактом сервера (not_eq) — throw на клієнті, не 400 з сервера', () => {
    expect(() =>
      toSubsetPayload({
        where: {
          type: 'func',
          name: 'not',
          args: [eq(ref('sectionId'), 's1')],
        } as never,
      }),
    ).toThrow(/поза контрактом/);
  });

  it('gt проходить як є', () => {
    expect(
      toSubsetPayload({ where: gt(ref('sortOrder'), 3) }).subset?.filters,
    ).toEqual([{ field: ['sortOrder'], operator: 'gt', value: 3 }]);
  });
});
