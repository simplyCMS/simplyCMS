// К3-Е6г, Task 7 (Е6г-16, Е6г-17): стерте замовлення — позиції не
// редагуються, старий токен нічого не віддає. Решта — `admin-customer-delete`.
import { describe, expect, it, vi } from 'vitest';
import {
  withOrderTokenDb,
  loadOrderDetail,
} from 'simplycms/storefront/loaders';
import {
  changeOrderStatusOp,
  deleteCustomerOp,
} from 'simplycms/admin-server/impl';
import { ADMIN_ID, useDeleteDb } from './fixtures/customer-delete';
import { conflict as itemConflict } from './fixtures/order-items-edit';

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

describe('admin: стерте замовлення (Е6г-16/17)', () => {
  const d = useDeleteDb('simplycms_e6g_delete_orders');
  const { f } = d;
  void ADMIN_ID;
  const call = (userId: string, confirmEmail: string) =>
    deleteCustomerOp({ data: { userId, confirmEmail } });

  it('Е6г-17: старий токен стертого замовлення нічого не віддає', async () => {
    const b = await d.seedBuyer();
    const id = await f.place([{ productId: f.ids.battery, quantity: 1 }], {
      userId: b.userId,
    });
    const t = `tok-${id}`;
    await f.rows(`update public.orders set access_token = $2 where id = $1`, [
      id,
      t,
    ]);
    const read = () => withOrderTokenDb(t, (tx) => loadOrderDetail(tx, id));
    expect(await read()).not.toBeNull();
    await call(b.userId, b.email);
    expect(await read()).toBeNull();
  });

  it('Е6г-16: позиції стертого замовлення не редагуються, скасування дозволене', async () => {
    const b = await d.seedBuyer();
    const id = await f.place([{ productId: f.ids.panel, quantity: 2 }], {
      userId: b.userId,
    });
    const item = await f.itemOf(id, f.ids.panel);
    await call(b.userId, b.email);
    const before = await f.snapshot(id);
    await expect(f.setQty(id, item, 1)).rejects.toMatchObject(
      itemConflict('order_personal_data_erased'),
    );
    expect(await f.snapshot(id)).toEqual(before);
    expect(
      (
        await f.one<{ e: string | null }>(
          `select email as e from public.orders where id = $1`,
          [id],
        )
      ).e,
    ).toBeNull();
    const cancelled = await f.id(
      `select id from public.order_statuses where code = 'cancelled'`,
      [],
    );
    await expect(
      changeOrderStatusOp({ data: { orderId: id, statusId: cancelled } }),
    ).resolves.toBeDefined();
  });
});
