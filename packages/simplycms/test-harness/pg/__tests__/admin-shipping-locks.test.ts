// Е6а (фінальне рев'ю, F1): локи guarded remove доставки — детерміновано.
// Advisory `shipping-config` доводять хелпери Е4-12 (`holdAdvisoryLock`/
// `stillPending`), рядковий `FOR UPDATE` залишку — `pg_blocking_pids` проти
// окремого зʼєднання (патерн `holdOrderRowLock` Е5): тест доводить САМЕ лок,
// а не FK RESTRICT, який стереже інший кейс (admin-shipping.test.ts).
import { describe, expect, it, vi } from 'vitest';
import { SHIPPING_PROVIDER } from 'simplycms/contracts/shipping-providers';
import {
  holdAdvisoryLock,
  holdRowLock,
  stillPending,
} from './fixtures/advisory-lock';
import { waitForBlockedBy } from './fixtures/orders';
import * as F from './fixtures/admin-shipping';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  removePickupPointsOp,
  removeShippingMethodsOp,
  removeShippingZonesOp,
} from 'simplycms/admin-server/impl';

const LOCK = 'shipping-config';
const PICKUP = SHIPPING_PROVIDER.pickup;

describe('admin: доставка — локи guarded remove (Е6а, F1)', () => {
  const db = F.useShippingAdminDb('simplycms_admin_shipping_locks');
  const url = () => db.url();
  const exists = async (table: string, id: string) =>
    (await F.rows(url(), `select 1 from public.${table} where id = $1`, [id]))
      .length === 1;
  const cases = {
    shipping_methods: async () => {
      const id = await F.seedMethod(url(), PICKUP);
      return { id, run: () => removeShippingMethodsOp({ data: [{ id }] }) };
    },
    shipping_zones: async () => {
      const id = await F.seedZone(url());
      return { id, run: () => removeShippingZonesOp({ data: [{ id }] }) };
    },
    pickup_points: async () => {
      const id = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
      return { id, run: () => removePickupPointsOp({ data: [{ id }] }) };
    },
  };

  it.each(Object.keys(cases) as (keyof typeof cases)[])(
    'remove %s стоїть, поки зовнішній тримає SHIPPING_CONFIG_LOCK; після release — видалено',
    async (table) => {
      const { id, run } = await cases[table]();
      const lock = await holdAdvisoryLock(url(), LOCK);
      try {
        const op = run();
        op.catch(() => {}); // результат — expect нижче
        expect(await stillPending(op, 300)).toBe(true);
        expect(await exists(table, id)).toBe(true);
        await lock.release();
        await expect(op).resolves.toEqual({ count: 1 });
        expect(await exists(table, id)).toBe(false);
      } finally {
        await lock.cleanup();
      }
    },
  );

  it('гонка removeShippingZones(B) ↔ setDefaultShippingZone(B): B уже дефолтна в незакоміченій транзакції → remove відмовляє, дефолтна рівно одна', async () => {
    await F.rows(url(), `update public.shipping_zones set is_default = false`);
    const a = await F.seedZone(url());
    await F.rows(
      url(),
      `update public.shipping_zones set is_default = true where id = $1`,
      [a],
    );
    const b = await F.seedZone(url());
    // Конкурент — транзакція setDefaultShippingZoneOp(B) за мить до COMMIT
    // (лок, дефолт A → B): паузи всередині справжньої операції немає.
    const setDefault = await holdRowLock(
      url(),
      'select pg_advisory_xact_lock(hashtextextended($1, 0))',
      [LOCK],
    );
    try {
      await setDefault.query(
        `update public.shipping_zones set is_default = false where id = $1`,
        [a],
      );
      await setDefault.query(
        `update public.shipping_zones set is_default = true where id = $1`,
        [b],
      );
      const op = removeShippingZonesOp({ data: [{ id: b }] });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await setDefault.release();
      await expect(op).rejects.toMatchObject(
        F.conflict('state', 'shipping_zone_default'),
      );
      const DEFAULTS = `select id from public.shipping_zones where is_default`;
      expect(await F.rows(url(), DEFAULTS)).toEqual([{ id: b }]);
    } finally {
      await setDefault.cleanup();
    }
  });

  it('remove точки стоїть САМЕ на `select … from stock_by_pickup_point … for update` (pg_blocking_pids); залишок, змінений конкурентом, не губиться', async () => {
    const point = await F.seedPoint(url(), await F.seedMethod(url(), PICKUP));
    const stock = await F.seedStock(url(), point, 0);
    const holder = await holdRowLock(
      url(),
      `select id from public.stock_by_pickup_point where pickup_point_id = $1 for update`,
      [point],
    );
    try {
      // Конкурент (повернення залишку) змінює рядок до COMMIT: без FOR UPDATE
      // remove прочитав би 0 і видалив би рядок із 4 одиницями.
      await holder.query(
        `update public.stock_by_pickup_point set quantity = 4 where id = $1`,
        [stock],
      );
      const op = removePickupPointsOp({ data: [{ id: point }] });
      op.catch(() => {});
      const waiter = await waitForBlockedBy(url(), holder.pid);
      expect(waiter.query).toMatch(
        /^select [\s\S]* from "stock_by_pickup_point" [\s\S]* for update$/i,
      );
      await holder.release();
      await expect(op).rejects.toMatchObject(
        F.conflict('state', 'pickup_point_has_stock'),
      );
      expect(
        await F.rows(
          url(),
          `select quantity from public.stock_by_pickup_point where id = $1`,
          [stock],
        ),
      ).toEqual([{ quantity: 4 }]);
      expect(await exists('pickup_points', point)).toBe(true);
    } finally {
      await holder.cleanup();
    }
  });
});
