// К3-Е6в, Task 10 (З-4, Е6в-6/8/25): діагностика ціни — ТЕ САМЕ ядро, що чекаут.
import { describe, expect, it, vi } from 'vitest';
import { priceItems } from 'simplycms/commerce';
import { withActor } from 'simplycms/db';
import * as C from './fixtures/commerce';
import { percentDiscountStatements } from './fixtures/discounts';
import * as F from './fixtures/admin-discounts';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { diagnosePriceOp } from 'simplycms/admin-server/impl';

describe('admin: діагностика ціни тим самим ядром (Е6в, Task 10)', () => {
  const db = F.useDiscountsAdminDb('simplycms_admin_price_diag', {
    commerce: true,
  });
  const diagnose = (
    userId: string | null,
    productId: string,
    otherCartTotal = 0,
  ) =>
    diagnosePriceOp({
      data: {
        userId,
        productId,
        modificationId: null,
        quantity: 1,
        otherCartTotal,
      },
    });
  const checkout = async (
    userId: string | null,
    productId: string,
    extraCartTotal = 0,
  ) => {
    const out = await withActor(
      { role: 'app_user', userId: userId ?? undefined },
      (tx) =>
        priceItems(
          tx,
          userId,
          [{ productId, modificationId: null, quantity: 1 }],
          { extraCartTotal },
        ),
    );
    if (out === 'not_purchasable') throw new Error(out);
    return out[0]!.price;
  };

  it('гість: фінальна ціна збігається з чекаутом, знижка пояснена', async () => {
    const d = await diagnose(null, C.PANEL_450);
    expect(d.finalPrice).toBe(await checkout(null, C.PANEL_450));
    expect(d.applied.map((a) => a.name)).toEqual([C.ORACLE_DISCOUNT]);
    expect(d.basePrice).toBeGreaterThan(d.finalPrice!);
  });

  it('покупець з категорією (гурт): збігається з чекаутом, категорія й тип ціни гурту', async () => {
    const d = await diagnose(db.wholesale(), C.PANEL_450);
    expect(d.finalPrice).toBe(await checkout(db.wholesale(), C.PANEL_450));
    expect(d.applied).toEqual([]);
    expect(d.rejected).toEqual([]);
    const guest = await diagnose(null, C.PANEL_450);
    expect(d.categoryId).not.toBe(guest.categoryId);
    expect(d.priceTypeId).not.toBe(guest.priceTypeId);
  });

  it('поріг суми через otherCartTotal збігається з чекаутом', async () => {
    const under = await diagnose(null, C.BATTERY_200AH);
    const over = await diagnose(null, C.BATTERY_200AH, 40000);
    expect(under.applied).toEqual([]);
    expect(over.applied.map((a) => a.name)).toEqual([C.CART_DISCOUNT]);
    expect(over.finalPrice).toBe(await checkout(null, C.BATTERY_200AH, 40000));
    expect(under.finalPrice).toBe(await checkout(null, C.BATTERY_200AH));
  });

  it('неактивна знижка й знижка в неактивній групі — у rejected, ціна не змінюється', async () => {
    const before = await diagnose(null, C.INVERTER_8KW);
    const target = { type: 'product', id: C.INVERTER_8KW } as const;
    for (const s of [
      ...percentDiscountStatements({
        group: 'Вимкнена група',
        name: 'У вимкненій групі',
        percent: 30,
        target,
      }),
      ...percentDiscountStatements({
        group: 'Жива група',
        name: 'Вимкнена знижка',
        percent: 20,
        target,
        isActive: false,
      }),
    ])
      await F.rows(db.url(), s);
    await F.rows(
      db.url(),
      `update public.discount_groups set is_active = false where name = 'Вимкнена група'`,
    );
    const after = await diagnose(null, C.INVERTER_8KW);
    expect(after.finalPrice).toBe(before.finalPrice);
    expect(after.finalPrice).toBe(await checkout(null, C.INVERTER_8KW));
    const reasons = Object.fromEntries(
      after.rejected.map((r) => [r.name, r.reason]),
    );
    expect(reasons).toMatchObject({
      'Вимкнена знижка': 'inactive',
      'У вимкненій групі': 'group_inactive',
    });
  });

  it('знижка з роком 10000 (SQL) — у rejected з discount_invalid, решта рахується', async () => {
    const target = { type: 'product', id: C.STATION_10KWH } as const;
    for (const s of [
      ...percentDiscountStatements({
        group: 'Добра 2',
        name: 'Валідна −10%',
        percent: 10,
        target,
      }),
      ...percentDiscountStatements({
        group: 'Зіпсована 2',
        name: 'Зіпсована −50%',
        percent: 50,
        target,
      }),
    ])
      await F.rows(db.url(), s);
    await F.rows(
      db.url(),
      `update public.discounts set ends_at = '10000-01-01 00:00:00+00' where name = 'Зіпсована −50%'`,
    );
    const d = await diagnose(null, C.STATION_10KWH);
    expect(d.applied.map((a) => a.name)).toEqual(['Валідна −10%']);
    expect(d.rejected).toContainEqual(
      expect.objectContaining({
        name: 'Зіпсована −50%',
        groupName: 'Зіпсована 2',
        reason: 'discount_invalid',
      }),
    );
    expect(d.finalPrice).toBe(await checkout(null, C.STATION_10KWH));
  });
});
