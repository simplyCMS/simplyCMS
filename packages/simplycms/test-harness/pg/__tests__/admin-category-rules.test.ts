// К3-Е6в, Task 6 (Е6в-19, Е6в-20): ресурс автоправил і «Запустити всі».
// Окрема БД: `runCategoryRules` обходить УСІ профілі, тож `checked` точний
// лише там, де покупців рівно стільки, скільки засіяв тест.
import { describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  categoryRulesOps,
  runCategoryRulesOp,
} from 'simplycms/admin-server/impl';

const byDomain = (domain: string) => ({
  type: 'all',
  rules: [{ field: 'email_domain', operator: '=', value: domain }],
});

describe('admin: автоправила категорій (Е6в-19)', () => {
  const db = F.useCustomersDb('simplycms_admin_category_rules');
  const url = () => db.url();
  const rule = (o: Record<string, unknown>) => ({
    id: crypto.randomUUID(),
    name: 'Правило',
    fromCategoryId: null,
    toCategoryId: F.DEFAULT_CATEGORY,
    conditions: F.ORDERS_GTE_2,
    ...o,
  });
  const rulesCount = async () =>
    (
      await F.rows(
        url(),
        `select count(*)::int as n from public.category_rules`,
      )
    )[0]!.n;

  it('runCategoryRules: 3 покупці — 1 відповідає, 1 заблокований (теж відповідає) → { checked: 3, changed: 1 }', async () => {
    const from = await F.seedCategory(url());
    const vip = await F.seedCategory(url());
    const match = await F.seedCustomer(url(), {
      categoryId: from,
      email: 'one@vip.test',
    });
    const locked = await F.seedCustomer(url(), {
      categoryId: from,
      locked: true,
      email: 'two@vip.test',
    });
    const other = await F.seedCustomer(url(), {
      categoryId: from,
      email: 'three@other.test',
    });
    const ruleId = await F.seedRule(url(), {
      from,
      to: vip,
      conditions: byDomain('vip.test'),
    });

    await expect(runCategoryRulesOp()).resolves.toEqual({
      checked: 3,
      changed: 1,
      failed: 0,
    });
    expect(await F.customerState(url(), match)).toEqual({
      category_id: vip,
      category_locked: false,
    });
    expect(await F.customerState(url(), locked)).toEqual({
      category_id: from,
      category_locked: true,
    });
    expect(await F.customerState(url(), other)).toMatchObject({
      category_id: from,
    });
    expect(await F.historyOf(url(), match)).toEqual([
      expect.objectContaining({
        from_category_id: from,
        to_category_id: vip,
        rule_id: ruleId,
        changed_by: null,
      }),
    ]);
    expect(await F.historyOf(url(), locked)).toEqual([]);
  });

  it('ред.5: insertCategoryRules з auth_provider contains → 400; порожнє правило → 400; нічого не записано', async () => {
    const before = await rulesCount();
    const providerContains = {
      type: 'all',
      rules: [{ field: 'auth_provider', operator: 'contains', value: 'goog' }],
    };
    for (const conditions of [providerContains, { type: 'all', rules: [] }])
      await expect(
        categoryRulesOps.insert({ data: [rule({ conditions })] as never }),
      ).rejects.toMatchObject(F.invalid);
    expect(await rulesCount()).toBe(before);
  });

  it('from = to → category_rule_same_category (insert і update зі злиттям поточного рядка)', async () => {
    const cat = await F.seedCategory(url());
    await expect(
      categoryRulesOps.insert({
        data: [rule({ fromCategoryId: cat, toCategoryId: cat })] as never,
      }),
    ).rejects.toMatchObject(F.conflict('state', 'category_rule_same_category'));
    const id = await F.seedRule(url(), {
      from: cat,
      to: F.DEFAULT_CATEGORY,
      conditions: F.ORDERS_GTE_2,
    });
    await expect(
      categoryRulesOps.update({ data: [{ id, patch: { toCategoryId: cat } }] }),
    ).rejects.toMatchObject(F.conflict('state', 'category_rule_same_category'));
  });

  it('insert правила стоїть під CUSTOMER_CONFIG_LOCK; після release — записано', async () => {
    const lock = await holdAdvisoryLock(url(), 'customer-config');
    try {
      const op = categoryRulesOps.insert({ data: [rule({})] as never });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await lock.release();
      await expect(op).resolves.toHaveLength(1);
    } finally {
      await lock.cleanup();
    }
  });
});
