// К3-Е6г, Task 7 (Е6г-4, Е6г-15, Review Focus 3): локи, гонка з видачею ролі
// і обрив на стиранні файла аватара. Детерміновано: окремі pg-клієнти.
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { getMediaDriver } from 'simplycms/storage';
import { deleteCustomerOp } from 'simplycms/admin-server/impl';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import { ADMIN_ID, useDeleteDb } from './fixtures/customer-delete';
import { conflict as stateOf } from './fixtures/admin-shipping';
import * as H from '../apply.mjs';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: {
      userId: 'a0000000-0000-4000-8000-00000000e6a7',
      roles: ['admin'],
    },
    scope: 'any',
  })),
}));

describe('admin: видалення акаунта — локи й обрив (Е6г-4/15)', () => {
  const d = useDeleteDb('simplycms_e6g_delete_locks');
  const { f } = d;
  const call = (userId: string, confirmEmail: string) =>
    deleteCustomerOp({ data: { userId, confirmEmail } });
  void ADMIN_ID;

  it('роль видана під час видалення → customer_is_admin, аватар і рядок media цілі', async () => {
    const b = await d.seedBuyer({ avatar: true });
    const client = new pg.Client({
      connectionString: H.withUser(f.db.url, 'app_runtime'),
    });
    await client.connect();
    let closed = false;
    try {
      await client.query('begin');
      await client.query('set local role app_admin');
      await client.query(
        `select pg_advisory_xact_lock(hashtextextended('admin-roles', 0))`,
      );
      await client.query(
        `insert into public.user_roles (id, user_id, role) values (gen_random_uuid(), $1, 'admin')`,
        [b.userId],
      );
      const op = call(b.userId, b.email);
      op.catch(() => {});
      expect(await stillPending(op, 400)).toBe(true);
      expect(d.hasFile(b.avatar!)).toBe(true);
      await client.query('commit');
      closed = true;
      await client.end();
      await expect(op).rejects.toMatchObject(
        stateOf('state', 'customer_is_admin'),
      );
    } finally {
      if (!closed) {
        await client.query('rollback');
        await client.end();
      }
    }
    expect(d.hasFile(b.avatar!)).toBe(true);
    expect(await d.mediaRows(b.avatar!)).toHaveLength(1);
    expect(await d.userExists(b.userId)).toBe(true);
    await f.rows(`delete from public.user_roles where user_id = $1`, [
      b.userId,
    ]);
  });

  it.each(['customer-category:', 'admin-roles'])(
    'стоїть, поки зовнішній тримає %s',
    async (prefix) => {
      const b = await d.seedBuyer();
      const key = prefix === 'admin-roles' ? prefix : `${prefix}${b.userId}`;
      const lock = await holdAdvisoryLock(f.db.url, key);
      try {
        const op = call(b.userId, b.email);
        op.catch(() => {});
        expect(await stillPending(op, 300)).toBe(true);
        expect(await d.userExists(b.userId)).toBe(true);
        await lock.release();
        await expect(op).resolves.toMatchObject({ erasedOrders: 0 });
      } finally {
        await lock.cleanup();
      }
    },
  );

  it('обрив driver.delete → відкат усього; повтор зі справним драйвером завершує', async () => {
    const b = await d.seedBuyer({ avatar: true });
    const { address } = await d.placeThree(b.userId);
    await f.rows(
      `insert into public.product_reviews (id, product_id, user_id, rating, status)
       values (gen_random_uuid(), $1, $2, 4, 'approved')`,
      [f.ids.panel, b.userId],
    );
    const spy = vi
      .spyOn(getMediaDriver(), 'delete')
      .mockRejectedValueOnce(new Error('disk'));
    await expect(call(b.userId, b.email)).rejects.toThrow('disk');
    expect(await d.userExists(b.userId)).toBe(true);
    expect(
      (
        await f.one<{ e: string | null; a: string | null }>(
          `select email as e, access_token as a from public.orders where id = $1`,
          [address],
        )
      ).e,
    ).not.toBeNull();
    expect(await d.count('product_reviews', 'user_id = $1', [b.userId])).toBe(
      1,
    );
    expect(await d.mediaRows(b.avatar!)).toHaveLength(1);
    expect(d.hasFile(b.avatar!)).toBe(true);
    expect(await d.count('verifications', 'value = $1', [b.userId])).toBe(1);
    await expect(call(b.userId, b.email)).resolves.toMatchObject({
      erasedOrders: 3,
    });
    spy.mockRestore();
    expect(d.hasFile(b.avatar!)).toBe(false);
  });

  it('файла вже немає, рядок media є → успіх (ENOENT); без аватара → успіх', async () => {
    const b = await d.seedBuyer({ avatar: true });
    const { rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    rmSync(join(d.state.root, b.avatar!));
    await expect(call(b.userId, b.email)).resolves.toBeDefined();
    expect(await d.mediaRows(b.avatar!)).toEqual([]);
    const c = await d.seedBuyer();
    await expect(call(c.userId, c.email)).resolves.toBeDefined();
  });
});
