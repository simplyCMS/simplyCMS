// К3-Е6г, Task 7 (Е6г-15, Review Focus 2): видалення акаунта зі
// знеособленням замовлень. Локи й обрив — `-locks`, Е6г-16/17 — `-orders`.
import { describe, expect, it, vi } from 'vitest';
import { deleteCustomerOp } from 'simplycms/admin-server/impl';
import { ADMIN_ID, useDeleteDb } from './fixtures/customer-delete';
import { conflict as stateOf } from './fixtures/admin-shipping';

const grantAs = vi.hoisted(() => ({ id: '' }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: grantAs.id, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: видалення акаунта покупця (Е6г-15…17)', () => {
  const d = useDeleteDb('simplycms_e6g_delete');
  const { f } = d;
  const call = (userId: string, confirmEmail: string, as = ADMIN_ID) => {
    grantAs.id = as;
    return deleteCustomerOp({ data: { userId, confirmEmail } });
  };
  const rating = async (productId: string) =>
    (
      await f.one<{ avg: string }>(
        `select avg(rating)::text as avg from public.product_reviews where product_id = $1`,
        [productId],
      )
    ).avg;

  it('успіх: ПД стерто, суми й позиції лишились, відгук анонімний, аватара немає', async () => {
    const b = await d.seedBuyer({ avatar: true });
    const o = await d.placeThree(b.userId);
    const ids = Object.values(o);
    // Оформлення від імені користувача токена не видає — ставимо, щоб довести стирання.
    await f.rows(
      `update public.orders set access_token = 'tok-' || id where user_id = $1`,
      [b.userId],
    );
    await f.rows(
      `insert into public.product_reviews (id, product_id, user_id, rating, status)
       values (gen_random_uuid(), $1, $2, 4, 'approved'), (gen_random_uuid(), $1, null, 2, 'approved')`,
      [f.ids.panel, b.userId],
    );
    const before = {
      avg: await rating(f.ids.panel),
      sums: await Promise.all(ids.map((id) => f.snapshot(id))),
    };

    // Сід справді вказує на покупця — інакше «NULL після» нічого б не доводило.
    expect(
      await f.rows(
        `select changed_by from public.user_category_history where user_id = $1`,
        [b.other],
      ),
    ).toEqual([{ changed_by: b.userId }]);

    const res = await call(b.userId, `  ${b.email.toUpperCase()} `);
    expect(res).toEqual({ erasedOrders: 3, anonymizedReviews: 1 });

    expect(await d.userExists(b.userId)).toBe(false);
    for (const id of ids) {
      const r = await f.one<Record<string, unknown>>(
        `select * from public.orders where id = $1`,
        [id],
      );
      expect(r.user_id).toBeNull();
      expect(r.access_token).toBeNull();
      expect(r.email).toBeNull();
      expect(r.personal_data_erased_at).not.toBeNull();
    }
    expect(await Promise.all(ids.map((id) => f.snapshot(id)))).toEqual(
      before.sums,
    );
    expect(
      await d.count('product_reviews', 'user_id is null and rating = 4', []),
    ).toBe(1);
    expect(await rating(f.ids.panel)).toBe(before.avg);
    expect(d.hasFile(b.avatar!)).toBe(false);
    expect(await d.mediaRows(b.avatar!)).toEqual([]);
    expect(await d.count('verifications', 'value = $1', [b.userId])).toBe(0);
    // Власна історія зникла, чужий рядок лишився з changed_by = NULL.
    expect(
      await d.count('user_category_history', 'user_id = $1', [b.userId]),
    ).toBe(0);
    expect(
      await f.rows(
        `select changed_by from public.user_category_history where user_id = $1`,
        [b.other],
      ),
    ).toEqual([{ changed_by: null }]);
    expect(await d.orphans()).toEqual({});
  });

  it('відмови: адмін, себе, невірний email, неіснуючий', async () => {
    const adm = await d.seedBuyer({ avatar: true });
    await f.rows(
      `insert into public.user_roles (id, user_id, role) values (gen_random_uuid(), $1, 'admin')`,
      [adm.userId],
    );
    await expect(call(adm.userId, adm.email)).rejects.toMatchObject(
      stateOf('state', 'customer_is_admin'),
    );
    expect(d.hasFile(adm.avatar!)).toBe(true);
    await expect(call(adm.userId, adm.email, adm.userId)).rejects.toMatchObject(
      stateOf('state', 'customer_self'),
    );
    await f.rows(`delete from public.user_roles where user_id = $1`, [
      adm.userId,
    ]);
    await expect(call(adm.userId, 'no@x.test')).rejects.toMatchObject({
      name: 'ValidationError',
      issues: [{ path: ['confirmEmail'], code: 'invalid_value' }],
    });
    expect(await d.userExists(adm.userId)).toBe(true);
    await expect(call(crypto.randomUUID(), 'a@x.test')).rejects.toMatchObject(
      stateOf('state', 'customer_not_found'),
    );
  });
});
