// К3-Е6в, Task 5 (Е6в-14, Е6в-16): `saveDiscount` у ціноутворенні, дати,
// права й перевірка категорій умови. Шапка — патерн admin-shipping.test.ts:
// grant рахує СПРАВЖНЯ матриця (кейс не-адміна доводить `discount.manage`).
import { describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { priceItems } from 'simplycms/commerce';
import { STATION_10KWH } from './fixtures/commerce';
import { guest, line } from './fixtures/commerce-db';
import * as F from './fixtures/admin-discounts';

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
  discountGroupsOps,
  getDiscountOp,
  removeDiscountGroupsOp,
  saveDiscountOp,
} from 'simplycms/admin-server/impl';

const EMPTY = { discount: [], targets: [], conditions: [] };

describe('admin: знижки — ціни, дати, права (Е6в, Task 5)', () => {
  const db = F.useDiscountsAdminDb('simplycms_admin_discounts_rules', {
    commerce: true,
  });
  const url = () => db.url();
  const save = (data: ReturnType<typeof F.discountInput>) =>
    saveDiscountOp({ data: data as never });

  it('saveDiscount з priceTypeId null → рядок з NULL; priceItems застосовує його для двох типів цін', async () => {
    const station = [line(STATION_10KWH)];
    const wholesale = (fn: typeof priceItems) =>
      withActor({ role: 'app_user', userId: db.wholesale() }, (tx) =>
        fn(tx, db.wholesale(), station),
      );
    const pair = (out: Awaited<ReturnType<typeof priceItems>>) =>
      out === 'not_purchasable' ? out : out.map((i) => [i.price, i.basePrice]);
    expect(pair(await guest((tx) => priceItems(tx, null, station)))).toEqual([
      [68000, null],
    ]);
    expect(pair(await wholesale(priceItems))).toEqual([[60000, null]]);
    const input = F.discountInput(await F.seedGroup(url()), {
      targets: [{ targetType: 'product', targetId: STATION_10KWH }],
    });
    await save(input);
    expect((await F.snapshotDiscount(url(), input.id)).discount).toMatchObject([
      { price_type_id: null },
    ]);
    expect(pair(await guest((tx) => priceItems(tx, null, station)))).toEqual([
      [61200, 68000],
    ]);
    expect(pair(await wholesale(priceItems))).toEqual([[54000, 60000]]);
    await removeDiscountGroupsOp({ data: [{ id: input.groupId }] });
  });

  it('startsAt рівно 2026-03-29T00:30:00Z записується і читається тим самим Date', async () => {
    const startsAt = new Date('2026-03-29T00:30:00Z');
    const input = F.discountInput(await F.seedGroup(url()), { startsAt });
    const out = await save(input);
    expect(out.discount.startsAt?.toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
    const read = await getDiscountOp({ data: { id: input.id } });
    expect(read.discount.startsAt?.getTime()).toBe(startsAt.getTime());
    const [row] = await F.rows(
      url(),
      `select starts_at = '2026-03-29T00:30:00Z'::timestamptz as same from public.discounts where id = $1`,
      [input.id],
    );
    expect(row).toEqual({ same: true });
  });

  it('не-адмін → AuthzError, нічого не змінено', async () => {
    const group = await F.seedGroup(url());
    const input = F.discountInput(group);
    const newGroup = crypto.randomUUID();
    const before = await F.snapshotGroups(url(), [group]);
    SUBJECT.current = { userId: crypto.randomUUID(), roles: ['user'] };
    try {
      const authz = { name: 'AuthzError' };
      await expect(save(input)).rejects.toMatchObject(authz);
      await expect(
        discountGroupsOps.insert({ data: [{ id: newGroup, name: 'X' }] }),
      ).rejects.toMatchObject(authz);
      await expect(
        removeDiscountGroupsOp({ data: [{ id: group }] }),
      ).rejects.toMatchObject(authz);
      await expect(
        getDiscountOp({ data: { id: input.id } }),
      ).rejects.toMatchObject(authz);
    } finally {
      SUBJECT.current = { userId: null, roles: ['admin'] };
    }
    expect(await F.snapshotDiscount(url(), input.id)).toEqual(EMPTY);
    expect(await F.snapshotGroups(url(), [group, newGroup])).toEqual(before);
  });

  it('ред.2: saveDiscount з user_category in [неіснуючий id] → discount_condition_category_missing; нічого не записано', async () => {
    const existing = await F.seedCategory(url());
    const input = F.discountInput(await F.seedGroup(url()), {
      conditions: [
        {
          conditionType: 'user_category',
          operator: 'in',
          value: [existing, crypto.randomUUID()],
        },
      ],
    });
    await expect(save(input)).rejects.toMatchObject(
      F.conflict('state', 'discount_condition_category_missing'),
    );
    expect(await F.snapshotDiscount(url(), input.id)).toEqual(EMPTY);
  });
});
