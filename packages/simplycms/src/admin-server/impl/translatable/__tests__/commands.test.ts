import { describe, expect, it } from 'vitest';
import { OPERATION_ID_FORMAT } from 'simplycms/operations';
import {
  orderStatusesCreate,
  orderStatusesDeleteTranslation,
  orderStatusesGet,
  orderStatusesList,
  orderStatusesSaveDescription,
  orderStatusesSaveTranslation,
} from '../../order-statuses/commands';

// Юніт форми операцій фабрики (М2б, Р19): id та прапорці.
// Поведінку проти БД (зокрема відмову create без основної мови) доводить pg-тест
// `order-statuses-aggregate.test.ts`.
const WRITES = [
  orderStatusesCreate,
  orderStatusesSaveDescription,
  orderStatusesSaveTranslation,
  orderStatusesDeleteTranslation,
];

describe('команди перекладного агрегата: форма операцій (статуси)', () => {
  it('id відповідають OPERATION_ID_FORMAT і префіксу сутності', () => {
    for (const op of [...WRITES, orderStatusesGet, orderStatusesList]) {
      expect(op.id).toMatch(OPERATION_ID_FORMAT);
      expect(op.id.startsWith('order-statuses.')).toBe(true);
    }
    expect(WRITES.map((o) => o.id)).toEqual([
      'order-statuses.create',
      'order-statuses.saveDescription',
      'order-statuses.saveTranslation',
      'order-statuses.deleteTranslation',
    ]);
  });

  it('команди запису й get — versioned; create ідемпотентний; list без версії', () => {
    for (const op of [...WRITES, orderStatusesGet])
      expect(op.versioned, op.id).toBe(true);
    expect(orderStatusesCreate.idempotent).toBe('create');
    expect(orderStatusesList.versioned).toBeUndefined();
  });

  it('усі права — catalog.write, як у чинних операцій статусів', () => {
    for (const op of [...WRITES, orderStatusesGet, orderStatusesList])
      expect(op.permission, op.id).toBe('catalog.write');
  });

  it('save* приймають expectedVersion, create — ні', () => {
    for (const op of WRITES.slice(1))
      expect(
        'expectedVersion' in (op.input as never as { shape: object }).shape,
      ).toBe(true);
    expect(
      'expectedVersion' in
        (orderStatusesCreate.input as never as { shape: object }).shape,
    ).toBe(false);
  });
});
