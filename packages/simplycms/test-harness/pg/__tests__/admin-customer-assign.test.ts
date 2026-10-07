// К3-Е6в, Task 6 (Е6в-15, Е6в-18, Е6в-20): дефолтна категорія під
// `customer-config` (детерміновано — holdAdvisoryLock/stillPending), ручне
// призначення з `category_locked`, лічильник покупців і пошук покупця.
import { describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  assignCustomerCategoryOp,
  countCustomersByCategoryOp,
  findCustomersOp,
  setDefaultUserCategoryOp,
} from 'simplycms/admin-server/impl';

describe('admin: дефолт, ручне призначення, лічильник (Е6в-18/20)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_assign');
  const url = () => db.url();
  const defaults = () =>
    F.rows(
      url(),
      `select id from public.user_categories where is_default order by id`,
    );

  it('setDefault: стара знята, нова стоїть; повертає обидва рядки', async () => {
    const next = await F.seedCategory(url());
    const { rows } = await setDefaultUserCategoryOp({ data: { id: next } });
    const flags = Object.fromEntries(rows.map((r) => [r.id, r.isDefault]));
    expect(flags).toEqual({ [F.DEFAULT_CATEGORY]: false, [next]: true });
    expect(await defaults()).toEqual([{ id: next }]);
    await setDefaultUserCategoryOp({ data: { id: F.DEFAULT_CATEGORY } });
    expect(await defaults()).toEqual([{ id: F.DEFAULT_CATEGORY }]);
  });

  it('setDefault стоїть, поки зовнішній тримає CUSTOMER_CONFIG_LOCK; після release — рівно одна дефолтна', async () => {
    const next = await F.seedCategory(url());
    const lock = await holdAdvisoryLock(url(), 'customer-config');
    try {
      const op = setDefaultUserCategoryOp({ data: { id: next } });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect(await defaults()).toEqual([{ id: F.DEFAULT_CATEGORY }]);
      await lock.release();
      await op;
      expect(await defaults()).toEqual([{ id: next }]);
    } finally {
      await lock.cleanup();
      await setDefaultUserCategoryOp({ data: { id: F.DEFAULT_CATEGORY } });
    }
  });

  it('assignCustomerCategory → профіль, locked, історія (changed_by = адмін, rule_id NULL); повтор із locked:false — без історії', async () => {
    const vip = await F.seedCategory(url());
    const customer = await F.seedCustomer(url());
    await expect(
      assignCustomerCategoryOp({
        data: { userId: customer, categoryId: vip, reason: 'Оптовий клієнт' },
      }),
    ).resolves.toEqual({ categoryId: vip, locked: true });
    expect(await F.customerState(url(), customer)).toEqual({
      category_id: vip,
      category_locked: true,
    });
    const history = await F.historyOf(url(), customer);
    expect(history).toEqual([
      expect.objectContaining({
        from_category_id: null,
        to_category_id: vip,
        reason: 'Оптовий клієнт',
        changed_by: F.ADMIN_ID,
        rule_id: null,
      }),
    ]);

    await expect(
      assignCustomerCategoryOp({
        data: {
          userId: customer,
          categoryId: vip,
          reason: 'Той самий',
          locked: false,
        },
      }),
    ).resolves.toEqual({ categoryId: vip, locked: false });
    expect(await F.historyOf(url(), customer)).toEqual(history);
    expect(await F.customerState(url(), customer)).toEqual({
      category_id: vip,
      category_locked: false,
    });
  });

  it('assignCustomerCategory стоїть на локу покупця customer-category:<userId>', async () => {
    const customer = await F.seedCustomer(url());
    const lock = await holdAdvisoryLock(url(), `customer-category:${customer}`);
    try {
      const op = assignCustomerCategoryOp({
        data: {
          userId: customer,
          categoryId: F.DEFAULT_CATEGORY,
          reason: 'Лок',
        },
      });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await lock.release();
      await expect(op).resolves.toMatchObject({ locked: true });
    } finally {
      await lock.cleanup();
    }
  });

  it('countCustomersByCategory: профіль без категорії рахується в дефолтну; порожня категорія — 0', async () => {
    const empty = await F.seedCategory(url());
    const before = await countCustomersByCategoryOp();
    const of = (list: typeof before, id: string) =>
      list.find((r) => r.categoryId === id)?.customers;
    await F.seedCustomer(url(), { categoryId: null });
    const after = await countCustomersByCategoryOp();
    expect(of(after, F.DEFAULT_CATEGORY)).toBe(
      of(before, F.DEFAULT_CATEGORY)! + 1,
    );
    expect(of(after, empty)).toBe(0);
  });

  it('findCustomers: за email, з категорією (NULL → дефолтна); wildcard — літерал', async () => {
    const email = `find_me-${crypto.randomUUID().slice(0, 6)}@shop.test`;
    const userId = await F.seedCustomer(url(), { email });
    await expect(
      findCustomersOp({ data: { query: email.slice(0, 12) } }),
    ).resolves.toEqual([
      { userId, email, name: null, categoryName: 'Роздріб' },
    ]);
    await expect(findCustomersOp({ data: { query: '%%' } })).resolves.toEqual(
      [],
    );
    await expect(
      findCustomersOp({ data: { query: 'a' } }),
    ).rejects.toMatchObject(F.invalid);
  });
});
