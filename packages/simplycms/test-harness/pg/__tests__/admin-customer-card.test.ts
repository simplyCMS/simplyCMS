// К3-Е6г, Task 3: getCustomerCard. Review Focus 5: картка власника без
// `profiles` відкривається, `stats` — null, категорія — ефективна дефолтна.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/customer-categories';
import * as R from './fixtures/admin-customers-read';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { HISTORY_LIMIT, getCustomerCardOp } from 'simplycms/admin-server/impl';

describe('admin: картка покупця (Е6г-6)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_card');
  const url = () => db.url();

  it('картка: історія зі знімком назв і email адміна; власник без профілю → stats null, дефолтна категорія; невідомий → null', async () => {
    const buyer = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.user_category_history
         (id, user_id, from_category_id, to_category_id, from_category_name, to_category_name, reason, changed_by)
       values ($1, $2, null, $3, null, 'Знімок VIP', 'Оптовик', $4)`,
      [crypto.randomUUID(), buyer, F.DEFAULT_CATEGORY, F.ADMIN_ID],
    );
    await R.seedOrder(url(), {
      userId: buyer,
      statusId: R.STATUS_NEW,
      total: '100.50',
    });
    const card = (await getCustomerCardOp({ data: { userId: buyer } }))!;
    expect(card.stats).toEqual({ ordersCount: 1, totalPurchasesCents: 10050 });
    expect(card.category).toMatchObject({
      id: F.DEFAULT_CATEGORY,
      locked: false,
    });
    expect(card.history).toEqual([
      expect.objectContaining({
        fromName: null,
        toName: 'Знімок VIP',
        reason: 'Оптовик',
        byRule: false,
        changedByEmail: 'admin-e6v@example.test',
      }),
    ]);
    expect(card.isAdmin).toBe(false);

    const owner = await R.seedOwner(url());
    const ownerCard = (await getCustomerCardOp({ data: { userId: owner } }))!;
    expect(ownerCard).toMatchObject({
      stats: null,
      category: { id: F.DEFAULT_CATEGORY, locked: false },
      isAdmin: true,
    });
    expect(
      await getCustomerCardOp({ data: { userId: crypto.randomUUID() } }),
    ).toBeNull();
  });

  it('історія: новіші зверху, byRule лише у запису правила; понад ліміт — обрізано', async () => {
    const buyer = await F.seedCustomer(url());
    const rule = await F.seedRule(url(), {
      from: null,
      to: F.DEFAULT_CATEGORY,
      conditions: F.ORDERS_GTE_2,
    });
    const add = (reason: string, createdAt: string, ruleId: string | null) =>
      F.rows(
        url(),
        `insert into public.user_category_history
           (id, user_id, to_category_id, to_category_name, reason, rule_id, created_at)
         values ($1, $2, $3, 'Роздріб', $4, $5, $6)`,
        [
          crypto.randomUUID(),
          buyer,
          F.DEFAULT_CATEGORY,
          reason,
          ruleId,
          createdAt,
        ],
      );
    await add('середній', '2026-03-02T00:00:00Z', rule);
    await add('старий', '2026-03-01T00:00:00Z', null);
    await add('новий', '2026-03-03T00:00:00Z', null);
    const card = (await getCustomerCardOp({ data: { userId: buyer } }))!;
    expect(card.history.map((h) => [h.reason, h.byRule])).toEqual([
      ['новий', false],
      ['середній', true],
      ['старий', false],
    ]);

    const many = await F.seedCustomer(url());
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) {
      await F.rows(
        url(),
        `insert into public.user_category_history
           (id, user_id, to_category_id, to_category_name, reason, created_at)
         values ($1, $2, $3, 'Роздріб', $4, now() - ($5 || ' minutes')::interval)`,
        [crypto.randomUUID(), many, F.DEFAULT_CATEGORY, `№${i}`, String(i)],
      );
    }
    const capped = (await getCustomerCardOp({ data: { userId: many } }))!;
    expect(capped.history).toHaveLength(HISTORY_LIMIT);
    // Найстарішого (№50) серед повернутих немає: ліміт відсікає хвіст, а не голову.
    expect(capped.history.map((h) => h.reason)).not.toContain(
      `№${HISTORY_LIMIT}`,
    );
  });
});
