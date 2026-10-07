// К3-Е6в, Task 5 (Е6в-16, Review Focus 1): атомарний `saveDiscount` проти
// живої БД. Шапка — патерн admin-shipping.test.ts: операції з
// `simplycms/admin-server/impl`, grant рахує СПРАВЖНЯ матриця.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/admin-discounts';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { saveDiscountOp } from 'simplycms/admin-server/impl';

const EMPTY = { discount: [], targets: [], conditions: [] };
const quantity = (value: unknown) => ({
  conditionType: 'min_quantity',
  operator: '>=',
  value,
});

describe('admin: знижки — атомарний запис (Е6в, Task 5)', () => {
  const db = F.useDiscountsAdminDb('simplycms_admin_discounts');
  const url = () => db.url();
  const save = (data: ReturnType<typeof F.discountInput>) =>
    saveDiscountOp({ data: data as never });

  it('saveDiscount з невалідною умовою (min_quantity "abc") → 400; SQL: знижки, цілей і умов немає', async () => {
    const input = F.discountInput(await F.seedGroup(url()), {
      conditions: [quantity('abc')],
    });
    await expect(save(input)).rejects.toMatchObject(F.invalid);
    expect(await F.snapshotDiscount(url(), input.id)).toEqual(EMPTY);
  });

  it('saveDiscount існуючої з новим набором → старі цілі й умови видалені, нові записані, id цілей нові', async () => {
    const product = crypto.randomUUID();
    const section = crypto.randomUUID();
    const input = F.discountInput(await F.seedGroup(url()), {
      targets: [{ targetType: 'product', targetId: product }],
      conditions: [quantity(2)],
    });
    await save(input);
    const before = await F.snapshotDiscount(url(), input.id);
    const out = await save({
      ...input,
      name: 'Нова назва',
      targets: [
        { targetType: 'section', targetId: section },
        { targetType: 'product', targetId: product },
      ],
      conditions: [
        { conditionType: 'user_logged_in', operator: '=', value: true },
      ],
    });
    const after = await F.snapshotDiscount(url(), input.id);
    expect(after.discount).toMatchObject([{ name: 'Нова назва' }]);
    expect(
      after.targets.map((t) => [t.target_type, t.target_id]).sort(),
    ).toEqual(
      [
        ['product', product],
        ['section', section],
      ].sort(),
    );
    expect(after.conditions).toMatchObject([
      { condition_type: 'user_logged_in', operator: '=', value: true },
    ]);
    const oldIds = [...before.targets, ...before.conditions].map((r) => r.id);
    const newIds = [...after.targets, ...after.conditions].map((r) => r.id);
    expect(newIds.filter((id) => oldIds.includes(id))).toEqual([]);
    expect(out.targets.map((t) => t.id).sort()).toEqual(
      after.targets.map((t) => t.id),
    );
  });

  it('обрив після запису рядка знижки (тригер-фікстура RAISE на insert discount_conditions) → рядок знижки й старі цілі незмінні', async () => {
    const input = F.discountInput(await F.seedGroup(url()), {
      conditions: [quantity(2)],
    });
    await save(input);
    const before = await F.snapshotDiscount(url(), input.id);
    expect(before.conditions).toHaveLength(1);
    await F.rows(
      url(),
      `create function public.e6v_abort() returns trigger language plpgsql as
         $$ begin raise exception 'e6v-abort'; end $$;
       create trigger e6v_abort before insert on public.discount_conditions
         for each row execute function public.e6v_abort()`,
    );
    try {
      const error = await save({
        ...input,
        name: 'Не має записатись',
        targets: [{ targetType: 'product', targetId: crypto.randomUUID() }],
        conditions: [quantity(3)],
      }).catch((e: unknown) => e);
      expect(String((error as { cause?: Error }).cause?.message)).toContain(
        'e6v-abort',
      );
    } finally {
      await F.rows(
        url(),
        `drop trigger e6v_abort on public.discount_conditions;
         drop function public.e6v_abort()`,
      );
    }
    expect(await F.snapshotDiscount(url(), input.id)).toEqual(before);
  });

  it('saveDiscount з targets: [] → 400; з [all, product] → 400', async () => {
    const group = await F.seedGroup(url());
    for (const targets of [
      [],
      [
        { targetType: 'all', targetId: null },
        { targetType: 'product', targetId: crypto.randomUUID() },
      ],
    ]) {
      const input = F.discountInput(group, { targets });
      await expect(save(input)).rejects.toMatchObject(F.invalid);
      expect(await F.snapshotDiscount(url(), input.id)).toEqual(EMPTY);
    }
  });

  it('значення поза доменом (NaN, Infinity, percent 150, Invalid Date, рік 10000, startsAt = endsAt) → 400; нічого не записано', async () => {
    const group = await F.seedGroup(url());
    const at = new Date('2026-05-01T00:00:00Z');
    for (const over of [
      { discountValue: Number.NaN },
      { discountValue: Number.POSITIVE_INFINITY },
      { discountValue: 150 },
      { startsAt: new Date(Number.NaN) },
      { endsAt: new Date('+010000-01-01T00:00:00Z') },
      { startsAt: at, endsAt: at },
    ]) {
      const input = F.discountInput(group, over);
      await expect(save(input)).rejects.toMatchObject(F.invalid);
      expect(await F.snapshotDiscount(url(), input.id)).toEqual(EMPTY);
    }
  });
});
