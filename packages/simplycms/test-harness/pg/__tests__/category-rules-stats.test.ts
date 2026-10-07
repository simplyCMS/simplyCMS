// К3-Е6в, Task 6 (Е6в-15, Е6в-19): UTM у статистиці (ред.3/ред.4), порожнє
// правило fail-closed при «Запустити всі» (ред.2) і єдиний примітив локу
// (`lockCatalogTarget` ≡ `advisoryXactLock`, ред.2) — детерміновано.
import { describe, expect, it, vi } from 'vitest';
import { advisoryXactLock, withActor, type ActorDb } from 'simplycms/db';
import { applyCategoryRules } from 'simplycms/commerce';
import { stillPending } from './fixtures/advisory-lock';
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
  lockCatalogTarget,
  runCategoryRulesOp,
} from 'simplycms/admin-server/impl';

type Lock = (db: ActorDb, key: string) => Promise<void>;

/** Транзакція, що взяла лок і тримає його до `release()`. */
function holdInTransaction(lock: Lock, key: string) {
  let release!: () => void;
  let acquired!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const locked = new Promise<void>((r) => (acquired = r));
  const done = withActor({ role: 'app_admin' }, async (db) => {
    await lock(db, key);
    acquired();
    await gate;
  });
  // Збій тримача (лок не взявся) — відмова `ready`, а не вічне очікування.
  const ready = Promise.race([locked, done]);
  return { ready, release, done };
}

describe('автоправила: UTM, порожнє правило, примітив локу', () => {
  const db = F.useCustomersDb('simplycms_rules_stats');
  const url = () => db.url();
  const apply = (userId: string) =>
    withActor({ role: 'app_admin' }, (tx) => applyCategoryRules(tx, userId));

  it.each([
    ['ред.3: utm_campaign = spring', 'utm_campaign', 'spring', {}],
    [
      'ред.4: utm_source = google',
      'utm_source',
      'google',
      { utm_campaign: 'x' },
    ],
  ])(
    '%s → покупець із міткою переведений, без мітки — ні',
    async (_t, field, value, without) => {
      const from = await F.seedCategory(url());
      const to = await F.seedCategory(url());
      await F.seedRule(url(), {
        from,
        to,
        conditions: { type: 'all', rules: [{ field, operator: '=', value }] },
      });
      const tagged = await F.seedCustomer(url(), {
        categoryId: from,
        utm: { [field]: value },
      });
      const untagged = await F.seedCustomer(url(), {
        categoryId: from,
        utm: without,
      });
      expect(await apply(tagged)).toBe('changed');
      expect(await apply(untagged)).toBe('unchanged');
      expect(await F.customerState(url(), tagged)).toMatchObject({
        category_id: to,
      });
      expect(await F.customerState(url(), untagged)).toMatchObject({
        category_id: from,
      });
    },
  );

  it('ред.2: порожнє правило (rules: []) з to = VIP + runCategoryRules → changed: 0', async () => {
    await F.rows(url(), `update public.category_rules set is_active = false`);
    const vip = await F.seedCategory(url());
    await F.seedRule(url(), {
      from: null,
      to: vip,
      conditions: { type: 'any', rules: [] },
    });
    const customer = await F.seedCustomer(url());
    const result = await runCategoryRulesOp();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.changed).toBe(0);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: null,
    });
  });

  it.each([
    [
      'lockCatalogTarget тримає → advisoryXactLock чекає',
      lockCatalogTarget,
      advisoryXactLock,
    ],
    [
      'advisoryXactLock тримає → lockCatalogTarget чекає',
      advisoryXactLock,
      lockCatalogTarget,
    ],
  ] as [string, Lock, Lock][])(
    'ред.2 (Е6в-15): %s',
    async (_t, holder, waiter) => {
      const key = `e6v-lock-${crypto.randomUUID()}`;
      const held = holdInTransaction(holder, key);
      await held.ready;
      try {
        const op = withActor({ role: 'app_admin' }, (tx) => waiter(tx, key));
        op.catch(() => {});
        expect(await stillPending(op, 300)).toBe(true);
        held.release();
        await held.done;
        await expect(op).resolves.toBeUndefined();
      } finally {
        held.release();
        await held.done;
      }
    },
  );
});
