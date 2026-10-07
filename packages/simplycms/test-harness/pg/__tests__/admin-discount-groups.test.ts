// К3-Е6в, Task 5 (Е6в-17, ред.2): групи знижок проти живої БД — guard циклу,
// guard пари дат (злиття рядка з patch) і видалення піддерева під
// `discount-config`. Шапка — патерн admin-shipping-locks.test.ts.
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

import {
  discountGroupsOps,
  removeDiscountGroupsOp,
} from 'simplycms/admin-server/impl';

const CYCLE = F.conflict('state', 'discount_group_cycle');
const DATES = F.conflict('state', 'discount_group_dates_invalid');

describe('admin: групи знижок (Е6в, Task 5)', () => {
  const db = F.useDiscountsAdminDb('simplycms_admin_discount_groups');
  const url = () => db.url();
  const reparent = (id: string, parentGroupId: string | null) =>
    discountGroupsOps.update({ data: [{ id, patch: { parentGroupId } }] });

  it('update групи parentGroupId = власний id → discount_group_cycle; = онук → discount_group_cycle; SQL незмінний', async () => {
    const root = await F.seedGroup(url());
    const child = await F.seedGroup(url(), { parent: root });
    const grandchild = await F.seedGroup(url(), { parent: child });
    // Пакет: кожне ребро окремо безпечне відносно БД, разом — цикл.
    const a = await F.seedGroup(url());
    const b = await F.seedGroup(url());
    const all = [root, child, grandchild, a, b];
    const before = await F.snapshotGroups(url(), all);
    await expect(reparent(root, root)).rejects.toMatchObject(CYCLE);
    await expect(reparent(root, grandchild)).rejects.toMatchObject(CYCLE);
    await expect(
      discountGroupsOps.update({
        data: [
          { id: a, patch: { parentGroupId: b } },
          { id: b, patch: { parentGroupId: a } },
        ],
      }),
    ).rejects.toMatchObject(CYCLE);
    const self = crypto.randomUUID();
    await expect(
      discountGroupsOps.insert({
        data: [{ id: self, name: 'Сама собі батько', parentGroupId: self }],
      }),
    ).rejects.toMatchObject(CYCLE);
    expect(await F.snapshotGroups(url(), [...all, self])).toEqual(before);
    // Легальне перевішування (онука — до кореня) проходить.
    await expect(reparent(grandchild, root)).resolves.toMatchObject([
      { id: grandchild, parentGroupId: root },
    ]);
  });

  it('removeDiscountGroups батька → піддерево груп і знижок видалено каскадом', async () => {
    const root = await F.seedGroup(url());
    const child = await F.seedGroup(url(), { parent: root });
    const grandchild = await F.seedGroup(url(), { parent: child });
    const sibling = await F.seedGroup(url());
    const discounts = [
      await F.seedDiscount(url(), root),
      await F.seedDiscount(url(), grandchild),
    ];
    const kept = await F.seedDiscount(url(), sibling);
    const out = await removeDiscountGroupsOp({ data: [{ id: root }] });
    expect([...out.removed].sort()).toEqual([root, child, grandchild].sort());
    expect(await F.snapshotGroups(url(), [root, child, grandchild])).toEqual(
      [],
    );
    for (const id of discounts)
      expect(await F.snapshotDiscount(url(), id)).toEqual({
        discount: [],
        targets: [],
        conditions: [],
      });
    expect(await F.snapshotGroups(url(), [sibling])).toHaveLength(1);
    expect((await F.snapshotDiscount(url(), kept)).targets).toHaveLength(1);
  });

  it('removeDiscountGroups неіснуючого id → помилка; батько поруч не видалений', async () => {
    const root = await F.seedGroup(url());
    await expect(
      removeDiscountGroupsOp({
        data: [{ id: root }, { id: crypto.randomUUID() }],
      }),
    ).rejects.toThrow(/не існує/);
    expect(await F.snapshotGroups(url(), [root])).toHaveLength(1);
  });

  it('ред.2: insert групи з endsAt < startsAt → discount_group_dates_invalid; update лише endsAt раніше наявного startsAt → те саме; рядок незмінний', async () => {
    const id = crypto.randomUUID();
    await expect(
      discountGroupsOps.insert({
        data: [
          {
            id,
            name: 'Дати навпаки',
            startsAt: new Date('2026-06-01T00:00:00Z'),
            endsAt: new Date('2026-05-01T00:00:00Z'),
          },
        ],
      }),
    ).rejects.toMatchObject(DATES);
    expect(await F.snapshotGroups(url(), [id])).toEqual([]);
    const group = await F.seedGroup(url(), {
      startsAt: '2026-06-01T00:00:00Z',
      endsAt: '2026-07-01T00:00:00Z',
    });
    const before = await F.snapshotGroups(url(), [group]);
    for (const endsAt of ['2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z'])
      await expect(
        discountGroupsOps.update({
          data: [{ id: group, patch: { endsAt: new Date(endsAt) } }],
        }),
      ).rejects.toMatchObject(DATES);
    expect(await F.snapshotGroups(url(), [group])).toEqual(before);
    // Зняти лише дату початку — пара більше не перевіряється, запис проходить.
    await expect(
      discountGroupsOps.update({
        data: [
          {
            id: group,
            patch: { startsAt: null, endsAt: new Date('2026-05-01T00:00:00Z') },
          },
        ],
      }),
    ).resolves.toHaveLength(1);
  });

  it('дата групи поза доменом (Invalid Date, рік 10000) → 400; рядка немає', async () => {
    for (const startsAt of [
      new Date(Number.NaN),
      new Date('+010000-01-01T00:00:00Z'),
    ]) {
      const id = crypto.randomUUID();
      await expect(
        discountGroupsOps.insert({ data: [{ id, name: 'Дата', startsAt }] }),
      ).rejects.toMatchObject(F.invalid);
      expect(await F.snapshotGroups(url(), [id])).toEqual([]);
    }
  });
});
