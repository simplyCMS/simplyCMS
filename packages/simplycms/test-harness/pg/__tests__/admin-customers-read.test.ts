// К3-Е6г, Task 3: listCustomers (keyset, фільтри, пошук, агрегати) і
// getCustomerCard. Review Focus 5: власник без `profiles` є в списку й у картці.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/customer-categories';
import * as R from './fixtures/admin-customers-read';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  getCustomerCardOp,
  listCustomersOp,
} from 'simplycms/admin-server/impl';

describe('admin: читання покупців (Е6г-6)', () => {
  const db = F.useCustomersDb('simplycms_admin_customers_read');
  const url = () => db.url();
  const list = (data: Record<string, unknown> = {}, pageSize?: number) =>
    listCustomersOp({ data, pageSize } as never);
  const setCreated = (id: string, iso: string) =>
    F.rows(url(), `update public.users set created_at = $2 where id = $1`, [
      id,
      iso,
    ]);

  it('keyset: сторінки без дублів і пропусків, у т.ч. однаковий created_at і мікросекунди', async () => {
    const b1 = await F.seedCustomer(url());
    const b2 = await F.seedCustomer(url());
    const b3 = await F.seedCustomer(url());
    const owner = await R.seedOwner(url(), '2026-01-01T10:00:00Z');
    await setCreated(b1, '2026-01-03T10:00:00.123456Z');
    await setCreated(b2, '2026-01-02T10:00:00Z');
    await setCreated(b3, '2026-01-02T10:00:00Z');
    const ties = [b2, b3].sort().reverse();
    const expected = [F.ADMIN_ID, b1, ...ties, owner];

    const seen: string[] = [];
    let cursor: { createdAt: Date; id: string } | undefined;
    let pages = 0;
    do {
      const page = await list({ cursor }, 3);
      seen.push(...page.rows.map((r) => r.userId));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < 10);
    expect(seen).toEqual(expected);
    expect(pages).toBe(2);
  });

  it('власник без профілю: isAdmin і дефолтна категорія; фільтри role / banned / categoryId', async () => {
    const owner = await R.seedOwner(url());
    const banned = await F.seedCustomer(url());
    await F.rows(
      url(),
      `update public.users set banned_at = now() where id = $1`,
      [banned],
    );
    const implicit = await F.seedCustomer(url(), { categoryId: null });
    const { rows } = await list();
    const o = rows.find((r) => r.userId === owner)!;
    expect(o).toMatchObject({ isAdmin: true, categoryId: F.DEFAULT_CATEGORY });
    expect(o.categoryName).toEqual(expect.any(String));
    expect(o.ordersCount).toBe(0);

    const admins = await list({ role: 'admin' });
    expect(admins.rows.every((r) => r.isAdmin)).toBe(true);
    expect(admins.rows.map((r) => r.userId)).toContain(owner);
    expect(admins.rows.map((r) => r.userId)).not.toContain(implicit);

    const bans = await list({ banned: true });
    expect(bans.rows.map((r) => r.userId)).toEqual([banned]);
    expect(bans.rows[0]!.bannedAt).toBeInstanceOf(Date);

    const byCat = await list({ categoryId: F.DEFAULT_CATEGORY });
    expect(byCat.rows.map((r) => r.userId)).toEqual(
      expect.arrayContaining([implicit, owner]),
    );
    const customers = await list({ role: 'customer' });
    expect(customers.rows.map((r) => r.userId)).not.toContain(owner);
  });

  it('пошук: % не повертає всіх; 0671234567 знаходить +38 (067) 123-45-67', async () => {
    const buyer = await F.seedCustomer(url());
    await F.rows(
      url(),
      `update public.profiles set phone = '+38 (067) 123-45-67' where user_id = $1`,
      [buyer],
    );
    expect((await list({ search: '%%' })).rows).toHaveLength(0);
    expect((await list({ search: '__' })).rows).toHaveLength(0);
    const byPhone = await list({ search: '0671234567' });
    expect(byPhone.rows.map((r) => r.userId)).toEqual([buyer]);
    expect(byPhone.rows[0]!.phone).toBe('+38 (067) 123-45-67');
  });

  it('агрегати: нове 100.50 + status NULL 10 рахуються, скасоване 999 — ні', async () => {
    const buyer = await F.seedCustomer(url());
    await R.seedOrder(url(), {
      userId: buyer,
      statusId: R.STATUS_NEW,
      total: '100.50',
    });
    await R.seedOrder(url(), {
      userId: buyer,
      statusId: R.STATUS_CANCELLED,
      total: '999.00',
    });
    await R.seedOrder(url(), { userId: buyer, statusId: null, total: '10.00' });
    const { rows } = await list();
    const row = rows.find((r) => r.userId === buyer)!;
    expect(row).toMatchObject({ ordersCount: 2, ordersTotalCents: 11050 });
  });

  it('картка: історія зі знімком назв і email адміна; власник без профілю → stats null; невідомий → null', async () => {
    const buyer = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.user_category_history
         (id, user_id, from_category_id, to_category_id, from_category_name, to_category_name, reason, changed_by)
       values ($1, $2, null, $3, null, 'Знімок VIP', 'Оптовик', $4)`,
      [crypto.randomUUID(), buyer, F.DEFAULT_CATEGORY, F.ADMIN_ID],
    );
    await R.seedOrder(url(), {
      userId: buyer,
      statusId: R.STATUS_NEW,
      total: '100.50',
    });
    const card = (await getCustomerCardOp({ data: { userId: buyer } }))!;
    expect(card.stats).toEqual({ ordersCount: 1, totalPurchasesCents: 10050 });
    expect(card.category).toMatchObject({
      id: F.DEFAULT_CATEGORY,
      locked: false,
    });
    expect(card.history).toEqual([
      expect.objectContaining({
        fromName: null,
        toName: 'Знімок VIP',
        reason: 'Оптовик',
        byRule: false,
        changedByEmail: 'admin-e6v@example.test',
      }),
    ]);
    expect(card.isAdmin).toBe(false);

    const owner = await R.seedOwner(url());
    const ownerCard = (await getCustomerCardOp({ data: { userId: owner } }))!;
    expect(ownerCard).toMatchObject({
      stats: null,
      category: null,
      isAdmin: true,
    });
    expect(
      await getCustomerCardOp({ data: { userId: crypto.randomUUID() } }),
    ).toBeNull();
  });
});
