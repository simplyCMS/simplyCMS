// К3-Е6в, Task 6, fix round 1: ізоляція збоїв автоправил.
// Е6в-25 — один пошкоджений рядок правил не ламає розрахунок: рядок, що не
// розбирається (ключ прототипу, рядок замість обʼєкта, без `type`),
// пропускається з `console.error`, валідні правила діють — і після замовлення,
// і в «Запустити всі». Рішення контролера — збій одного покупця в «Запустити
// всі» не зупиняє решту (`failed`).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/customer-categories';
import { demoPickupInput } from './fixtures/orders';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));
vi.mock('simplycms/commerce', async (orig) => {
  const actual = await orig<typeof import('simplycms/commerce')>();
  return { ...actual, applyCategoryRules: vi.fn(actual.applyCategoryRules) };
});

import { applyCategoryRules } from 'simplycms/commerce';
import { runCategoryRulesOp } from 'simplycms/admin-server/impl';

const orders = (n: number) => ({
  type: 'all',
  rules: [{ field: 'orders_count', operator: '>=', value: String(n) }],
});
/** Отруєні умови: без `type` колишній рушій спрацював би; рядок і поле
 *  `toString` (ключ прототипу) валили б TypeError усі правила магазину. */
const POISONED = [
  { rules: orders(0).rules },
  'зламано',
  { type: 'all', rules: [{ field: 'toString', operator: '=', value: '1' }] },
];

describe('автоправила: ізоляція збоїв (Е6в-25)', () => {
  const db = F.useCustomersDb('simplycms_rules_isolation', { demo: true });
  const url = () => db.url();
  let input: PlaceOrderInput;
  beforeAll(async () => {
    input = await demoPickupInput(url());
  });
  afterEach(() => vi.restoreAllMocks());

  /** Джерело, «пастка» для отруєних (вищий пріоритет) і валідне правило у VIP. */
  const poisonedSetup = async (validConditions: unknown) => {
    const from = await F.seedCategory(url());
    const trap = await F.seedCategory(url());
    const vip = await F.seedCategory(url());
    const poisoned: string[] = [];
    for (const conditions of POISONED)
      poisoned.push(
        await F.seedRule(url(), { from, to: trap, conditions, priority: 10 }),
      );
    await F.seedRule(url(), { from, to: vip, conditions: validConditions });
    return { from, vip, poisoned };
  };
  const loggedFor = (errors: { mock: { calls: unknown[][] } }, id: string) =>
    errors.mock.calls.some((c) => String(c[0]).includes(id));
  const disable = (ids: string[]) =>
    F.rows(
      url(),
      `update public.category_rules set is_active = false where id = any($1::uuid[])`,
      [ids],
    );

  it('після замовлення: отруєні пропущені з console.error ([simplycms/commerce] + id), валідне правило діє', async () => {
    const { from, vip, poisoned } = await poisonedSetup(orders(1));
    const customer = await F.seedCustomer(url(), { categoryId: from });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await placeOrderFor(input, customer);
      expect(result.ok).toBe(true);
      expect(await F.customerState(url(), customer)).toMatchObject({
        category_id: vip,
      });
      expect(errors).toHaveBeenCalledTimes(poisoned.length);
      for (const id of poisoned) expect(loggedFor(errors, id)).toBe(true);
      expect(String(errors.mock.calls[0]![0])).toContain(
        '[simplycms/commerce]',
      );
    } finally {
      await disable(poisoned);
    }
  });

  it('«Запустити всі»: отруєні пропущені з console.error, валідне правило діє', async () => {
    const { from, vip, poisoned } = await poisonedSetup(orders(0));
    const customer = await F.seedCustomer(url(), { categoryId: from });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await runCategoryRulesOp();
      expect(result).toMatchObject({ failed: 0 });
      expect(result.changed).toBeGreaterThanOrEqual(1);
      expect(await F.customerState(url(), customer)).toMatchObject({
        category_id: vip,
      });
      for (const id of poisoned) expect(loggedFor(errors, id)).toBe(true);
    } finally {
      await disable(poisoned);
    }
  });

  it('«Запустити всі»: збій одного покупця → решта оброблена, failed: 1, console.error з [simplycms/admin-server]', async () => {
    const from = await F.seedCategory(url());
    const vip = await F.seedCategory(url());
    await F.seedRule(url(), { from, to: vip, conditions: orders(0) });
    const bad = await F.seedCustomer(url(), { categoryId: from });
    const good = await F.seedCustomer(url(), { categoryId: from });
    const real = vi.mocked(applyCategoryRules).getMockImplementation()!;
    vi.mocked(applyCategoryRules).mockImplementation(async (tx, userId) => {
      if (userId === bad) throw new Error('обрив зʼєднання');
      return real(tx, userId);
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [{ n }] = (await F.rows(
      url(),
      `select count(*)::int as n from public.profiles`,
    )) as { n: number }[];
    try {
      const result = await runCategoryRulesOp();
      expect(result).toMatchObject({ checked: n, failed: 1 });
      expect(await F.customerState(url(), good)).toMatchObject({
        category_id: vip,
      });
      expect(await F.customerState(url(), bad)).toMatchObject({
        category_id: from,
      });
      const adminLogs = errors.mock.calls.filter((c) =>
        String(c[0]).startsWith('[simplycms/admin-server]'),
      );
      expect(adminLogs).toHaveLength(1);
      expect(String(adminLogs[0]![0])).toContain(bad);
    } finally {
      vi.mocked(applyCategoryRules).mockImplementation(real);
    }
  });
});
