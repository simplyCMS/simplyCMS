// Фінальне рев'ю К3-Е6в (F2): `CUSTOMER_CONFIG_LOCK` у
// `removeUserCategoriesOp` — єдина серіалізація з `saveDiscount` з умовою
// `user_category` (id категорій у jsonb без FK). Детерміновано: зовнішній
// тримач advisory-ключа (`holdAdvisoryLock`/`stillPending`) і керована гонка
// через рядковий лок знижки (`holdRowLock` + `pg_blocking_pids`).
import { describe, expect, it, vi } from 'vitest';
import { discountInput } from './fixtures/admin-discount-input';
import {
  holdAdvisoryLock,
  holdRowLock,
  stillPending,
} from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';
import { waitForBlockedBy } from './fixtures/orders';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  removeUserCategoriesOp,
  saveDiscountOp,
} from 'simplycms/admin-server/impl';

describe('admin: видалення категорій покупців — лок (F2)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_categories_locks');
  const url = () => db.url();
  const categoryRows = (id: string) =>
    F.rows(url(), `select id from public.user_categories where id = $1`, [id]);

  it('F2: remove стоїть, поки зовнішній тримає CUSTOMER_CONFIG_LOCK; після release — видалено', async () => {
    const category = await F.seedCategory(url());
    const lock = await holdAdvisoryLock(url(), 'customer-config');
    try {
      const op = removeUserCategoriesOp({ data: [{ id: category }] });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect(await categoryRows(category)).toHaveLength(1);
      await lock.release();
      await expect(op).resolves.toEqual({ count: 1 });
    } finally {
      await lock.cleanup();
    }
  });

  it('F2: гонка saveDiscount(user_category in [X]) ↔ remove(X) — висячого id в умовах немає', async () => {
    const category = await F.seedCategory(url());
    const group = crypto.randomUUID();
    await F.rows(
      url(),
      `insert into public.discount_groups (id, name) values ($1, 'Гонка F2')`,
      [group],
    );
    const plain = discountInput(group);
    await saveDiscountOp({ data: plain as never });
    const withCategory = {
      ...plain,
      conditions: [
        { conditionType: 'user_category', operator: 'in', value: [category] },
      ],
    };
    // saveDiscount бере обидва локи, перевіряє категорію і стає на upsert
    // рядка знижки, який тримає конкурент, — саме у вікні між перевіркою й
    // COMMIT видалення без спільного локу стерло б категорію.
    const row = await holdRowLock(
      url(),
      'select id from public.discounts where id = $1 for update',
      [plain.id],
    );
    let removeWaited = false;
    let settled: PromiseSettledResult<unknown>[] = [];
    try {
      const save = saveDiscountOp({ data: withCategory as never });
      save.catch(() => {});
      await waitForBlockedBy(url(), row.pid);
      const remove = removeUserCategoriesOp({ data: [{ id: category }] });
      remove.catch(() => {});
      removeWaited = await stillPending(remove, 300);
      await row.release();
      settled = await Promise.allSettled([save, remove]);
    } finally {
      await row.cleanup();
    }
    const dangling = await F.rows(
      url(),
      `select v from public.discount_conditions c,
              jsonb_array_elements_text(c.value) v
        where c.condition_type = 'user_category'
          and not exists (select 1 from public.user_categories u where u.id::text = v)`,
    );
    expect(dangling).toEqual([]);
    expect(settled[0]?.status).toBe('fulfilled');
    expect(settled[1]).toMatchObject({
      status: 'rejected',
      reason: F.conflict('state', 'user_category_in_discount'),
    });
    expect(removeWaited).toBe(true);
  });
});
