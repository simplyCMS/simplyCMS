// К3-Е6в, Task 5 (Е6в-15, Е6в-16 ред.2): локи `discount-config` і
// `customer-config` — детерміновано (`holdAdvisoryLock`/`stillPending`), а не
// гонкою `Promise.all`. Порядок «customer → discount» доводить третє
// зʼєднання: поки операція чекає `discount-config`, `customer-config` уже її.
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/admin-discounts';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  discountGroupsOps,
  removeDiscountGroupsOp,
  saveDiscountOp,
} from 'simplycms/admin-server/impl';

const DISCOUNT_LOCK = 'discount-config';
const CUSTOMER_LOCK = 'customer-config';

/** Чи вільний advisory-ключ зараз (try-lock у короткій транзакції). */
async function lockIsFree(url: string, key: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ ok: boolean }>(
      'select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as ok',
      [key],
    );
    return rows[0]!.ok;
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

describe('admin: знижки — локи (Е6в, Task 5)', () => {
  const db = F.useDiscountsAdminDb('simplycms_admin_discounts_locks');
  const url = () => db.url();
  const byCategory = (groupId: string, categoryId: string) =>
    F.discountInput(groupId, {
      conditions: [
        { conditionType: 'user_category', operator: 'in', value: [categoryId] },
      ],
    });

  it('guard циклу стоїть, поки зовнішній тримає DISCOUNT_CONFIG_LOCK (holdAdvisoryLock/stillPending)', async () => {
    const root = await F.seedGroup(url());
    const child = await F.seedGroup(url(), { parent: root });
    const before = await F.snapshotGroups(url(), [root, child]);
    const lock = await holdAdvisoryLock(url(), DISCOUNT_LOCK);
    try {
      const op = discountGroupsOps.update({
        data: [{ id: root, patch: { parentGroupId: child } }],
      });
      op.catch(() => {}); // результат — expect нижче
      expect(await stillPending(op, 300)).toBe(true);
      await lock.release();
      await expect(op).rejects.toMatchObject(
        F.conflict('state', 'discount_group_cycle'),
      );
      expect(await F.snapshotGroups(url(), [root, child])).toEqual(before);
    } finally {
      await lock.cleanup();
    }
  });

  it('insert групи, saveDiscount і removeDiscountGroups стоять під DISCOUNT_CONFIG_LOCK; після release — записано', async () => {
    const group = await F.seedGroup(url());
    const doomed = await F.seedGroup(url());
    const runs = [
      () =>
        discountGroupsOps.insert({
          data: [{ id: crypto.randomUUID(), name: 'Під локом' }],
        }),
      () => saveDiscountOp({ data: F.discountInput(group) as never }),
      () => removeDiscountGroupsOp({ data: [{ id: doomed }] }),
    ];
    for (const run of runs) {
      const lock = await holdAdvisoryLock(url(), DISCOUNT_LOCK);
      try {
        const op = run();
        op.catch(() => {});
        expect(await stillPending(op, 300)).toBe(true);
        await lock.release();
        await expect(op).resolves.toBeTruthy();
      } finally {
        await lock.cleanup();
      }
    }
    expect(await F.snapshotGroups(url(), [doomed])).toEqual([]);
  });

  it('ред.2: зовнішнє зʼєднання тримає CUSTOMER_CONFIG_LOCK → saveDiscount з умовою user_category stillPending; без такої умови — проходить', async () => {
    const group = await F.seedGroup(url());
    const category = await F.seedCategory(url());
    const plain = F.discountInput(group);
    const withCategory = byCategory(group, category);
    const lock = await holdAdvisoryLock(url(), CUSTOMER_LOCK);
    try {
      await expect(
        saveDiscountOp({ data: plain as never }),
      ).resolves.toMatchObject({ discount: { id: plain.id } });
      const op = saveDiscountOp({ data: withCategory as never });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await lock.release();
      await expect(op).resolves.toMatchObject({
        conditions: [{ conditionType: 'user_category' }],
      });
    } finally {
      await lock.cleanup();
    }
  });

  it('ред.2: порядок локів customer-config → discount-config: saveDiscount з user_category, що чекає discount-config, уже тримає customer-config', async () => {
    const group = await F.seedGroup(url());
    const input = byCategory(group, await F.seedCategory(url()));
    const lock = await holdAdvisoryLock(url(), DISCOUNT_LOCK);
    try {
      const op = saveDiscountOp({ data: input as never });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect(await lockIsFree(url(), CUSTOMER_LOCK)).toBe(false);
      await lock.release();
      await expect(op).resolves.toMatchObject({ discount: { id: input.id } });
      expect(await lockIsFree(url(), CUSTOMER_LOCK)).toBe(true);
    } finally {
      await lock.cleanup();
    }
  });
});
