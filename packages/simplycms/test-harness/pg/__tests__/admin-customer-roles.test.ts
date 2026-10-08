// К3-Е6г, Task 4 (Е6г-4, Е6г-11): роль адміна з картки покупця під локом
// `admin-roles`. Лок доводиться детерміновано (holdAdvisoryLock/stillPending).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

const grantAs = vi.hoisted(() => ({ id: '' }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: grantAs.id, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setAdminRoleOp } from 'simplycms/admin-server/impl';

describe('admin: роль адміна (Е6г-4/11)', () => {
  const db = F.useCustomersDb('simplycms_admin_roles');
  const url = () => db.url();
  const LOCK = 'admin-roles';

  const makeAdmin = async (): Promise<string> => {
    const id = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.user_roles (id, user_id, role) values ($1, $2, 'admin')`,
      [crypto.randomUUID(), id],
    );
    return id;
  };
  const rolesOf = async (id: string) =>
    (
      await F.rows(
        url(),
        `select role::text from public.user_roles where user_id = $1 order by role`,
        [id],
      )
    ).map((r) => r.role);
  const adminCount = async () =>
    Number(
      (
        await F.rows(
          url(),
          `select count(*) as n from public.user_roles where role = 'admin'`,
        )
      )[0]!.n,
    );
  const call = (actor: string, userId: string, admin: boolean) => {
    grantAs.id = actor;
    return setAdminRoleOp({ data: { userId, admin } });
  };
  // Кожен тест починає з порожнього набору адмінів, щоб лічильник був чесним.
  afterEach(async () => {
    await F.rows(url(), `delete from public.user_roles where role = 'admin'`);
  });

  it('видача → рядок admin; повтор → без помилки й без дубля; рядок user не чіпається', async () => {
    const actor = await makeAdmin();
    const target = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.user_roles (id, user_id, role) values ($1, $2, 'user')`,
      [crypto.randomUUID(), target],
    );
    await expect(call(actor, target, true)).resolves.toEqual({ isAdmin: true });
    await expect(call(actor, target, true)).resolves.toEqual({ isAdmin: true });
    expect(await rolesOf(target)).toEqual(['admin', 'user']);
    await expect(call(actor, target, false)).resolves.toEqual({
      isAdmin: false,
    });
    expect(await rolesOf(target)).toEqual(['user']);
  });

  it('зняття з себе → admin_role_self, роль на місці', async () => {
    const actor = await makeAdmin();
    await makeAdmin();
    await expect(call(actor, actor, false)).rejects.toMatchObject(
      F.conflict('state', 'admin_role_self'),
    );
    expect(await rolesOf(actor)).toEqual(['admin']);
  });

  it('єдиний адмін знімає роль з не-адміна → no-op; два адміни: A→B ок, B→A admin_role_last', async () => {
    const a = await makeAdmin();
    const plain = await F.seedCustomer(url());
    await expect(call(a, plain, false)).resolves.toEqual({ isAdmin: false });
    const b = await makeAdmin();
    await expect(call(a, b, false)).resolves.toEqual({ isAdmin: false });
    // B уже не адмін; A — єдиний, тож зняти його може лише «сам із себе».
    await expect(call(b, a, false)).rejects.toMatchObject(
      F.conflict('state', 'admin_role_last'),
    );
    expect(await adminCount()).toBe(1);
  });

  it('видача забаненому → admin_role_banned, ролі немає (Е6г-11)', async () => {
    const actor = await makeAdmin();
    const target = await F.seedCustomer(url());
    await F.rows(
      url(),
      `update public.users set banned_at = now() where id = $1`,
      [target],
    );
    await expect(call(actor, target, true)).rejects.toMatchObject(
      F.conflict('state', 'admin_role_banned'),
    );
    expect(await rolesOf(target)).toEqual([]);
  });

  it('стоїть, поки зовнішній тримає admin-roles; після release завершується', async () => {
    const actor = await makeAdmin();
    const target = await F.seedCustomer(url());
    const lock = await holdAdvisoryLock(url(), LOCK);
    try {
      const op = call(actor, target, true);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect(await rolesOf(target)).toEqual([]);
      await lock.release();
      await expect(op).resolves.toEqual({ isAdmin: true });
    } finally {
      await lock.cleanup();
    }
  });

  it('гонка: A знімає B і B знімає A під зайнятим локом → одна OK, друга admin_role_last, адмінів 1', async () => {
    const a = await makeAdmin();
    const b = await makeAdmin();
    const lock = await holdAdvisoryLock(url(), LOCK);
    try {
      const opAB = call(a, b, false);
      const opBA = call(b, a, false);
      const settled = Promise.allSettled([opAB, opBA]);
      expect(await stillPending(settled, 300)).toBe(true);
      expect(await adminCount()).toBe(2);
      await lock.release();
      const results = await settled;
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected');
      expect((failed as PromiseRejectedResult).reason).toMatchObject(
        F.conflict('state', 'admin_role_last'),
      );
      expect(await adminCount()).toBe(1);
    } finally {
      await lock.cleanup();
    }
  });
});
