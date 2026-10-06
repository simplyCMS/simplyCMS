// Е6а, Task 4 (Е6а-12, Е6а-20): зони доставки — рівно одна дефолтна, і вона
// завжди активна. Шапка — патерн admin-catalog-dictionaries.test.ts (операції
// напряму з `simplycms/admin-server/impl`, requireGrant мокається модульно);
// лок доводиться хелперами Е4-12 (`holdAdvisoryLock`/`stillPending`).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
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
  removeShippingZonesOp,
  setDefaultShippingZoneOp,
  shippingZonesOps,
} from 'simplycms/admin-server/impl';

const state = (constraint: string) => F.conflict('state', constraint);

describe('admin: доставка — зони (Е6а, Task 4)', () => {
  const db = F.useShippingAdminDb('simplycms_admin_shipping_zones');
  const url = () => db.url();
  let DEFAULT = '';
  const defaults = async () =>
    (
      await F.rows(
        url(),
        `select id from public.shipping_zones where is_default order by id`,
      )
    ).map((r) => r.id);
  const zone = async (id: string) =>
    (
      await F.rows(
        url(),
        `select is_active, is_default from public.shipping_zones where id = $1`,
        [id],
      )
    )[0];

  // Кожен кейс стартує з власної свіжої дефолтної зони — двома кроками
  // (частковий unique-індекс перевіряється негайно).
  beforeEach(async () => {
    await F.rows(url(), `update public.shipping_zones set is_default = false`);
    DEFAULT = await F.seedZone(url());
    await F.rows(
      url(),
      `update public.shipping_zones set is_default = true where id = $1`,
      [DEFAULT],
    );
  });

  it('update зони { isActive: false } для дефолтної → shipping_zone_default; setDefault неактивної → shipping_zone_inactive', async () => {
    await expect(
      shippingZonesOps.update({
        data: [{ id: DEFAULT, patch: { isActive: false } }],
      }),
    ).rejects.toMatchObject(state('shipping_zone_default'));
    expect(await zone(DEFAULT)).toEqual({ is_active: true, is_default: true });

    const inactive = await F.seedZone(url(), false);
    await expect(
      setDefaultShippingZoneOp({ data: { id: inactive } }),
    ).rejects.toMatchObject(state('shipping_zone_inactive'));
    expect(await defaults()).toEqual([DEFAULT]);
    expect(await zone(inactive)).toEqual({
      is_active: false,
      is_default: false,
    });
  });

  it('setDefault зони: стара дефолтна знята, нова стоїть; no-op для вже дефолтної', async () => {
    const target = await F.seedZone(url());
    const { rows } = await setDefaultShippingZoneOp({ data: { id: target } });
    expect(rows.map((r) => [r.id, r.isDefault]).sort()).toEqual(
      [
        [DEFAULT, false],
        [target, true],
      ].sort(),
    );
    expect(await defaults()).toEqual([target]);

    const again = await setDefaultShippingZoneOp({ data: { id: target } });
    expect(again.rows.map((r) => [r.id, r.isDefault])).toEqual([
      [target, true],
    ]);
    expect(await defaults()).toEqual([target]);
  });

  it('remove дефолтної зони → shipping_zone_default; зона й тарифи на місці', async () => {
    const rate = await F.seedRate(
      url(),
      await F.seedMethod(url(), 'core:address'),
      DEFAULT,
    );
    const spare = await F.seedZone(url());
    await expect(
      removeShippingZonesOp({ data: [{ id: spare }, { id: DEFAULT }] }),
    ).rejects.toMatchObject(state('shipping_zone_default'));
    expect(await defaults()).toEqual([DEFAULT]);
    expect(await zone(spare)).toBeDefined();
    expect(
      await F.rows(
        url(),
        `select zone_id from public.shipping_rates where id = $1`,
        [rate],
      ),
    ).toEqual([{ zone_id: DEFAULT }]);
  });

  it('setDefault стоїть, поки зовнішній тримає SHIPPING_CONFIG_LOCK (holdAdvisoryLock/stillPending Е4-12)', async () => {
    const target = await F.seedZone(url());
    const lock = await holdAdvisoryLock(url(), 'shipping-config');
    try {
      const op = setDefaultShippingZoneOp({ data: { id: target } });
      expect(await stillPending(op, 300)).toBe(true);
      expect(await defaults()).toEqual([DEFAULT]);
      await lock.release();
      await expect(op).resolves.toBeDefined();
      expect(await defaults()).toEqual([target]);
    } finally {
      await lock.cleanup();
    }
  });
});
