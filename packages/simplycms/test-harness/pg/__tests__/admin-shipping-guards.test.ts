// Е6а, Task 4 (Е6а-12, Е6а-16): guard-хук фабрики — інваріанти insert/update
// способів і точок перевіряє СЕРВЕР під `shipping-config`, а не лише UI.
// Шапка — патерн admin-catalog-dictionaries.test.ts (операції напряму з
// `simplycms/admin-server/impl`, requireGrant мокається модульно).
import { describe, expect, it, vi } from 'vitest';
import { SHIPPING_PROVIDER } from 'simplycms/contracts/shipping-providers';
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
  pickupPointsOps,
  shippingMethodsOps,
} from 'simplycms/admin-server/impl';

const { address: ADDRESS, pickup: PICKUP } = SHIPPING_PROVIDER;
const state = (constraint: string) => F.conflict('state', constraint);
let n = 0;
const point = (methodId: string) => ({
  id: crypto.randomUUID(),
  methodId,
  name: `Точка г-${++n}`,
  address: 'вул. Г, 1',
  city: 'Київ',
});
const method = (provider: string, over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  code: `e6a_g_${++n}`,
  name: 'Спосіб г',
  provider,
  ...over,
});

describe('admin: доставка — guard-и insert/update (Е6а, Task 4)', () => {
  const db = F.useShippingAdminDb('simplycms_admin_shipping_guards');
  const url = () => db.url();
  const count = async (table: string, ids: string[]) =>
    (
      await F.rows(
        url(),
        `select count(*)::int n from public.${table} where id = any($1::uuid[])`,
        [ids],
      )
    )[0]!.n;
  const methodRow = async (id: string) =>
    (
      await F.rows(
        url(),
        `select provider, pricing, name from public.shipping_methods where id = $1`,
        [id],
      )
    )[0];

  it('змішаний batch insertPickupPoints [валідна, з адресним methodId] → відмова; ЖОДНОГО рядка не вставлено', async () => {
    const ok = point(await F.seedMethod(url(), PICKUP));
    const bad = point(await F.seedMethod(url(), ADDRESS));
    await expect(
      pickupPointsOps.insert({ data: [ok, bad] }),
    ).rejects.toMatchObject(state('pickup_point_method_invalid'));
    expect(await count('pickup_points', [ok.id, bad.id])).toBe(0);
  });

  it('прямий insertPickupPoints з methodId адресного способу → pickup_point_method_invalid; рядка немає', async () => {
    const bad = point(await F.seedMethod(url(), ADDRESS));
    await expect(pickupPointsOps.insert({ data: [bad] })).rejects.toMatchObject(
      state('pickup_point_method_invalid'),
    );
    expect(await count('pickup_points', [bad.id])).toBe(0);
  });

  it('прямий insertShippingMethods з provider "nova-poshta:x" → відмова; рядка немає', async () => {
    const bad = method('nova-poshta:x');
    await expect(
      shippingMethodsOps.insert({ data: [bad] }),
    ).rejects.toMatchObject(state('shipping_provider_unknown'));
    expect(await count('shipping_methods', [bad.id])).toBe(0);
  });

  it('спосіб core:address з pricing provider (insert і update) → shipping_pricing_unsupported; рядок незмінний', async () => {
    const bad = method(ADDRESS, { pricing: 'provider' });
    await expect(
      shippingMethodsOps.insert({ data: [bad] }),
    ).rejects.toMatchObject(state('shipping_pricing_unsupported'));
    expect(await count('shipping_methods', [bad.id])).toBe(0);

    const id = await F.seedMethod(url(), ADDRESS);
    const before = await methodRow(id);
    await expect(
      shippingMethodsOps.update({
        data: [{ id, patch: { pricing: 'provider', name: 'Нова назва' } }],
      }),
    ).rejects.toMatchObject(state('shipping_pricing_unsupported'));
    expect(await methodRow(id)).toEqual(before);
    expect(before).toMatchObject({ pricing: 'rates' });
  });

  it('provider незмінний: update з provider → ключ відкинуто схемою, provider у БД старий', async () => {
    const id = await F.seedMethod(url(), PICKUP);
    const [row] = await shippingMethodsOps.update({
      data: [
        { id, patch: { name: 'Перейменований', provider: ADDRESS } as never },
      ],
    });
    expect(row).toMatchObject({ provider: PICKUP, name: 'Перейменований' });
    expect(await methodRow(id)).toMatchObject({
      provider: PICKUP,
      name: 'Перейменований',
    });
  });

  it('guard виконується ПІСЛЯ lock: insert точки стоїть, поки зовнішній тримає лок', async () => {
    const ok = point(await F.seedMethod(url(), PICKUP));
    const late = point(await F.seedMethod(url(), PICKUP));
    const lock = await holdAdvisoryLock(url(), 'shipping-config');
    try {
      const okOp = pickupPointsOps.insert({ data: [ok] });
      const lateOp = pickupPointsOps.insert({ data: [late] });
      lateOp.catch(() => {}); // відмову перевіряє expect нижче
      expect(await stillPending(okOp, 300)).toBe(true);
      expect(await count('pickup_points', [ok.id, late.id])).toBe(0);
      // Поки лок тримає «конкурент», спосіб `late` стає адресним: guard ДО
      // локу побачив би старий pickup і пропустив би точку.
      await F.rows(
        url(),
        `update public.shipping_methods set provider = $2 where id = $1`,
        [late.methodId, ADDRESS],
      );
      await lock.release();
      await expect(okOp).resolves.toHaveLength(1);
      await expect(lateOp).rejects.toMatchObject(
        state('pickup_point_method_invalid'),
      );
      expect(await count('pickup_points', [ok.id])).toBe(1);
      expect(await count('pickup_points', [late.id])).toBe(0);
    } finally {
      await lock.cleanup();
    }
  });
});
