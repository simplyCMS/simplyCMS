// К3-Е5б Task 3: редагування позицій поруч із покупцем і локами (Е5б-8,
// Е5б-7′) — скасування кабінетом після правок повертає рівно актуальний
// облік; операція стоїть САМЕ на локу замовлення; проєкція без
// `access_token`; не-адмін не проходить.
import { describe, expect, it, vi } from 'vitest';
import { cancelOwnOrder, withCustomerDb } from 'simplycms/storefront/loaders';
import { holdOrderRowLock } from './fixtures/advisory-lock';
import { rowLocksOnStock, waitForBlockedBy } from './fixtures/orders';
import { useOrderItemsEditDb } from './fixtures/order-items-edit';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { requireGrant, resolveGrant, AuthzError } from 'simplycms/auth';

describe('admin: редагування позицій, покупець і локи (К3-Е5б, Task 3)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_locks');
  const { ids } = f;

  it('редагування → cancelOwnOrder покупцем повертає рівно актуальні stock_reserved (Review Focus 2)', async () => {
    const initial = await f.stock(ids.panel);
    const o = await f.place(
      [
        { productId: ids.panel, quantity: 2 },
        { productId: ids.battery, quantity: 1 },
      ],
      { userId: ids.user },
    );
    const first = await f.itemOf(o, ids.panel);
    await f.add(o, ids.panel, 3);
    await f.setQty(o, first, 1);
    await f.remove(o, await f.itemOf(o, ids.battery));
    expect(await f.stock(ids.panel)).toBe(initial - 4);
    expect((await f.items(o)).map((i) => i.stockReserved)).toEqual([1, 3]);

    const result = await withCustomerDb(ids.user, (db, operator) =>
      cancelOwnOrder(db, operator, o),
    );
    expect(result).toEqual({ ok: true });
    expect(await f.stock(ids.panel)).toBe(initial);
    expect((await f.items(o)).map((i) => i.stockReserved)).toEqual([0, 0]);
  });

  it('(лок) поки рядок замовлення зайнятий holdOrderRowLock — операція стоїть на `select … from "orders" … for update` і не тримає локів order_items/stock_by_pickup_point (Review Focus 4)', async () => {
    const o = await f.place([{ productId: ids.panel, quantity: 1 }]);
    const item = await f.itemOf(o, ids.panel);
    const initial = await f.stock(ids.panel);
    const holder = await holdOrderRowLock(f.db.url, o);
    try {
      const op = f.setQty(o, item, 3);
      op.catch(() => {}); // результат побачить await нижче
      const waiter = await waitForBlockedBy(f.db.url, holder.pid);
      expect(waiter.query).toMatch(
        /^select [\s\S]* from "orders" [\s\S]* for update$/i,
      );
      expect(await rowLocksOnStock(f.db.url, waiter.pid)).toBe(0);
      await holder.release();
      await op;
      expect(await f.stock(ids.panel)).toBe(initial - 2);
    } finally {
      await holder.cleanup();
    }
  });

  it('рядки результату без accessToken (колонкові гранти restrictOrdersSelectForAdmin)', async () => {
    const o = await f.place([{ productId: ids.battery, quantity: 1 }]);
    const added = await f.add(o, ids.panel, 1);
    const updated = await f.setQty(o, added.upserted[0]!.id, 2);
    const removed = await f.remove(o, added.upserted[0]!.id);
    for (const { order } of [added, updated, removed]) {
      expect(order.id).toBe(o);
      expect(order).not.toHaveProperty('accessToken');
    }
  });

  it('не-адмін → AuthzError', async () => {
    const o = await f.place([{ productId: ids.panel, quantity: 1 }]);
    const item = await f.itemOf(o, ids.panel);
    const before = await f.snapshot(o);
    vi.mocked(requireGrant).mockImplementation(async (operation) => {
      const subject = { userId: ids.user, roles: ['user'] as const };
      const scope = resolveGrant(subject, operation);
      if (!scope) throw new AuthzError(operation);
      return { subject, scope };
    });
    try {
      await expect(f.add(o, ids.panel, 1)).rejects.toThrow(AuthzError);
      await expect(f.setQty(o, item, 2)).rejects.toThrow(AuthzError);
      await expect(f.remove(o, item)).rejects.toThrow(AuthzError);
    } finally {
      vi.mocked(requireGrant).mockReset();
      vi.mocked(requireGrant).mockImplementation(async () => ({
        subject: { userId: null, roles: ['admin'] },
        scope: 'any',
      }));
    }
    expect(await f.snapshot(o)).toEqual(before);
  });
});
