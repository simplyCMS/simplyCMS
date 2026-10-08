// Showcase Task 4 (С-2, С-15): ядра операцій покупця Е6г поза HTTP-запитом —
// у транзакції викликача під `withActor({ role: 'app_admin' })`, без
// `requireGrant`. Актор — явний `CoreActor`: `system` пише `changed_by = NULL`
// і не має перевірки «не я», але «не адмін» діє так само, як в операції.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

import { setResponseStatus } from '@tanstack/react-start/server';
import { withActor, type ActorDb } from 'simplycms/db';
import * as A from 'simplycms/admin-server/impl';

const asAdmin = <T>(fn: (db: ActorDb) => Promise<T>) =>
  withActor({ role: 'app_admin' }, fn);
const SYSTEM: A.CoreActor = { kind: 'system' };
const ADMIN: A.CoreActor = { kind: 'admin', userId: F.ADMIN_ID };

describe('ядра операцій покупця поза запитом (showcase Task 4)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_cores');
  const url = () => db.url();
  const makeAdmin = (userId: string) =>
    F.rows(
      url(),
      `insert into public.user_roles (id, user_id, role) values (gen_random_uuid(), $1, 'admin')`,
      [userId],
    );
  const emailOf = async (userId: string) =>
    String(
      (
        await F.rows(url(), `select email from public.users where id = $1`, [
          userId,
        ])
      )[0]!.email,
    );
  const assign = (userId: string, categoryId: string, actor: A.CoreActor) =>
    asAdmin((tx) =>
      A.assignCustomerCategory(
        tx,
        A.assignCustomerCategoryInput.parse({
          userId,
          categoryId,
          reason: 'Сід',
        }),
        actor,
      ),
    );
  const remove = (userId: string, email: string, actor: A.CoreActor) =>
    asAdmin((tx) =>
      A.deleteCustomer(tx, { userId, confirmEmail: email }, actor),
    );

  it('assignCustomerCategory: system → changed_by NULL, admin → id адміна', async () => {
    const vip = await F.seedCategory(url());
    const bySystem = await F.seedCustomer(url());
    const byAdmin = await F.seedCustomer(url());
    await expect(assign(bySystem, vip, SYSTEM)).resolves.toEqual({
      categoryId: vip,
      locked: true,
    });
    await assign(byAdmin, vip, ADMIN);
    expect(await F.customerState(url(), bySystem)).toEqual({
      category_id: vip,
      category_locked: true,
    });
    const history = await F.rows(
      url(),
      `select user_id, changed_by from public.user_category_history
        where user_id = any($1::uuid[]) and to_category_id = $2`,
      [[bySystem, byAdmin], vip],
    );
    expect(
      Object.fromEntries(history.map((h) => [String(h.user_id), h.changed_by])),
    ).toEqual({ [bySystem]: null, [byAdmin]: F.ADMIN_ID });
  });

  it('setCustomerBan: бан ставить banned_at; адміна — customer_is_admin', async () => {
    const buyer = await F.seedCustomer(url());
    const res = await asAdmin((tx) =>
      A.setCustomerBan(tx, { userId: buyer, banned: true, reason: 'Сід' }),
    );
    expect(res.bannedAt).toBeInstanceOf(Date);
    const admin = await F.seedCustomer(url());
    await makeAdmin(admin);
    await expect(
      asAdmin((tx) => A.setCustomerBan(tx, { userId: admin, banned: true })),
    ).rejects.toMatchObject(F.conflict('state', 'customer_is_admin'));
  });

  it('deleteCustomer(system) видаляє покупця; адміна — customer_is_admin', async () => {
    const buyer = await F.seedCustomer(url());
    await expect(remove(buyer, await emailOf(buyer), SYSTEM)).resolves.toEqual({
      erasedOrders: 0,
      anonymizedReviews: 0,
    });
    expect(
      await F.rows(url(), `select 1 from public.users where id = $1`, [buyer]),
    ).toEqual([]);

    const admin = await F.seedCustomer(url());
    await makeAdmin(admin);
    await expect(
      remove(admin, await emailOf(admin), SYSTEM),
    ).rejects.toMatchObject(F.conflict('state', 'customer_is_admin'));
  });

  it('deleteCustomer(admin) — «не я» лише для admin-актора', async () => {
    const self = await F.seedCustomer(url());
    await expect(
      remove(self, await emailOf(self), { kind: 'admin', userId: self }),
    ).rejects.toMatchObject(F.conflict('state', 'customer_self'));
    // Ядро поза запитом статус відповіді не чіпає (С-10).
    expect(setResponseStatus).not.toHaveBeenCalled();
  });
});
