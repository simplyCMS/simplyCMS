import { describe, expect, it } from 'vitest';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { OPERATION_ID_FORMAT } from 'simplycms/operations';
import type { ActorDb } from 'simplycms/db';
import {
  orderStatusesCreate,
  orderStatusesDeleteTranslation,
  orderStatusesGet,
  orderStatusesList,
  orderStatusesSaveDescription,
  orderStatusesSaveTranslation,
} from '../../order-statuses/commands';

// Юніт форми операцій фабрики (М2б, Р19): id, прапорці й рання відмова create.
// Поведінку проти БД доводить pg-тест `order-statuses-aggregate.test.ts`.
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

  it('create без рядка основної мови → ValidationError зі шляхом texts.<основна>.name', async () => {
    // Усі запити до БД (замок, основна мова, відомі мови) — `execute`; підставний db
    // віддає єдину мову `uk`. Рядок основної мови порожній: до запису не доходить.
    const db = {
      execute: async () => ({ rows: [{ code: 'uk' }] }),
    } as unknown as ActorDb;
    const err = await orderStatusesCreate
      .run(
        {
          db,
          afterCommit: () => undefined,
          subject: { userId: null, roles: ['admin'] },
          actor: { kind: 'system' },
        },
        { id: crypto.randomUUID(), code: 'x', texts: { uk: {} } } as never,
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0]?.path).toEqual([
      'texts',
      'uk',
      'name',
    ]);
  });
});
