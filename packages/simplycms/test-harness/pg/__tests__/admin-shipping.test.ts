// Е6а, Task 4 (Е6а-12, Е6а-17): видалення способів і точок доставки проти
// живої БД. Шапка — патерн admin-catalog-dictionaries.test.ts (serverFn не
// викликаються, операції — з `simplycms/admin-server/impl`). Grant рахує
// СПРАВЖНЯ матриця (`requireOperation`) — кейс не-адміна доводить `shipping.manage`.
import { describe, expect, it, vi } from 'vitest';
import { SHIPPING_PROVIDER } from 'simplycms/contracts/shipping-providers';
import { holdUncommittedStock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/admin-shipping';

const SUBJECT = vi.hoisted(() => ({
  current: { userId: null as string | null, roles: ['admin'] as string[] },
}));
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => {
  const auth = await orig<typeof import('simplycms/auth')>();
  return {
    ...auth,
    requireGrant: vi.fn(async (op: Parameters<typeof auth.requireGrant>[0]) => {
      const subject = SUBJECT.current as Parameters<typeof auth.can>[0];
      return { subject, scope: auth.requireOperation(subject, op) };
    }),
  };
});

import {
  removePickupPointsOp,
  removeShippingMethodsOp,
  shippingMethodsOps,
} from 'simplycms/admin-server/impl';

const PICKUP = SHIPPING_PROVIDER.pickup;

describe('admin: доставка — видалення (Е6а, Task 4)', () => {
  const db = F.useShippingAdminDb('simplycms_admin_shipping');
  const url = () => db.url();
  const exists = async (table: string, id: string) =>
    (await F.rows(url(), `select 1 from public.${table} where id = $1`, [id]))
      .length === 1;
  const STOCK_OF = `select id, quantity from public.stock_by_pickup_point
    where pickup_point_id = $1 order by id`;
  const stockOf = (pointId: string) => F.rows(url(), STOCK_OF, [pointId]);

  it('remove способу з точками → AdminConflictError reference; SQL: точки, залишки, тарифи й кількості незмінні', async () => {
    // A — точка із залишком; B — точка без рядків залишку: B червоніє, якщо
    // FK способу повернуть на cascade навіть при RESTRICT залишку.
    for (const withStock of [true, false]) {
      const method = await F.seedMethod(url(), PICKUP);
      const point = await F.seedPoint(url(), method);
      if (withStock) await F.seedStock(url(), point, 7);
      await F.seedRate(url(), method, await F.seedZone(url()));
      const before = await F.snapshotShipping(url(), method);
      await expect(
        removeShippingMethodsOp({ data: [{ id: method }] }),
      ).rejects.toMatchObject(F.conflict('reference'));
      expect(await F.snapshotShipping(url(), method)).toEqual(before);
    }
  });

  it('remove точки з quantity <> 0 → pickup_point_has_stock; рядки залишку незмінні', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    await F.seedStock(url(), point, 5);
    await F.seedStock(url(), point, 0);
    const before = await stockOf(point);
    await expect(
      removePickupPointsOp({ data: [{ id: point }] }),
    ).rejects.toMatchObject(F.conflict('state', 'pickup_point_has_stock'));
    expect(await stockOf(point)).toEqual(before);
    expect(await exists('pickup_points', point)).toBe(true);
  });

  it('remove точки, на яку посилається позиція зі stock_reserved > 0 → pickup_point_has_stock', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    await F.seedStock(url(), point, 0);
    const item = await F.seedReservedItem(url(), point, 2);
    await expect(
      removePickupPointsOp({ data: [{ id: point }] }),
    ).rejects.toMatchObject(F.conflict('state', 'pickup_point_has_stock'));
    expect(await exists('pickup_points', point)).toBe(true);
    expect(await stockOf(point)).toHaveLength(1);
    expect(
      await F.rows(
        url(),
        `select stock_point_id, stock_reserved from public.order_items where id = $1`,
        [item],
      ),
    ).toEqual([{ stock_point_id: point, stock_reserved: 2 }]);
  });

  it('remove точки лише з нульовими рядками залишку → видалено разом із рядками', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    await F.seedStock(url(), point, 0);
    await F.seedStock(url(), point, 0);
    await expect(
      removePickupPointsOp({ data: [{ id: point }] }),
    ).resolves.toEqual({ count: 1 });
    expect(await exists('pickup_points', point)).toBe(false);
    expect(await stockOf(point)).toEqual([]);
  });

  it('гонка: незакомічений insert рядка залишку на точку (окреме зʼєднання) → remove стоїть (stillPending); COMMIT → AdminConflictError reference; рядок і точка на місці', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    const hold = await holdUncommittedStock(
      url(),
      point,
      await F.seedProduct(url()),
    );
    try {
      const op = removePickupPointsOp({ data: [{ id: point }] });
      op.catch(() => {}); // відмову перевіряє expect нижче
      expect(await stillPending(op, 300)).toBe(true);
      await hold.release();
      await expect(op).rejects.toMatchObject(F.conflict('reference'));
      expect(await exists('pickup_points', point)).toBe(true);
      expect(await stockOf(point)).toHaveLength(1);
    } finally {
      await hold.cleanup();
    }
  });

  it('remove системної точки → pickup_point_system; точка на місці', async () => {
    const method = await F.seedMethod(url(), PICKUP);
    const point = await F.seedPoint(url(), method, true);
    await expect(
      removePickupPointsOp({ data: [{ id: point }] }),
    ).rejects.toMatchObject(F.conflict('state', 'pickup_point_system'));
    expect(await exists('pickup_points', point)).toBe(true);
  });

  it('не-адмін → AuthzError, нічого не змінено', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    const id = crypto.randomUUID();
    SUBJECT.current = { userId: crypto.randomUUID(), roles: ['user'] };
    try {
      await expect(
        removePickupPointsOp({ data: [{ id: point }] }),
      ).rejects.toMatchObject({ name: 'AuthzError' });
      await expect(
        shippingMethodsOps.insert({
          data: [{ id, code: 'e6a_authz', name: 'X', provider: PICKUP }],
        }),
      ).rejects.toMatchObject({ name: 'AuthzError' });
    } finally {
      SUBJECT.current = { userId: null, roles: ['admin'] };
    }
    expect(await exists('pickup_points', point)).toBe(true);
    expect(await exists('shipping_methods', id)).toBe(false);
  });
});
