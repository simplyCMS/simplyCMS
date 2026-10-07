// К3-Е6в, Task 6 (Е6в-18, Review Focus 4): guarded видалення категорій
// покупців. Кожна відмова — свій state-код (409), і після неї SQL показує, що
// категорія, профілі й правила на місці. Категорія з історією, але без
// покупців, видаляється — історія лишається з `NULL` і знімком назви.
import { describe, expect, it, vi } from 'vitest';
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
  assignCustomerCategoryOp,
  removeUserCategoriesOp,
} from 'simplycms/admin-server/impl';

describe('admin: видалення категорій покупців (Е6в-18)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_categories');
  const url = () => db.url();

  /** Категорії, профілі й правила, що стосуються категорії `id`. */
  const footprint = async (id: string) => ({
    category: await F.rows(
      url(),
      `select id, name, is_default from public.user_categories where id = $1`,
      [id],
    ),
    profiles: await F.rows(
      url(),
      `select user_id, category_id from public.profiles where category_id = $1 order by user_id`,
      [id],
    ),
    rules: await F.rows(
      url(),
      `select id from public.category_rules
        where from_category_id = $1 or to_category_id = $1 order by id`,
      [id],
    ),
  });

  const refusesWith = async (id: string, constraint: string) => {
    const before = await footprint(id);
    expect(before.category).toHaveLength(1);
    await expect(
      removeUserCategoriesOp({ data: [{ id }] }),
    ).rejects.toMatchObject(F.conflict('state', constraint));
    expect(await footprint(id)).toEqual(before);
  };

  it('дефолтна → user_category_default; нічого не змінено', async () => {
    await refusesWith(F.DEFAULT_CATEGORY, 'user_category_default');
  });

  it('з покупцем → user_category_has_customers; категорія й профіль на місці', async () => {
    const category = await F.seedCategory(url());
    await F.seedCustomer(url(), { categoryId: category });
    await refusesWith(category, 'user_category_has_customers');
  });

  it('з правилом (from або to) → user_category_has_rules; правила на місці', async () => {
    const asTarget = await F.seedCategory(url());
    await F.seedRule(url(), {
      from: null,
      to: asTarget,
      conditions: F.ORDERS_GTE_2,
    });
    await refusesWith(asTarget, 'user_category_has_rules');
    const asSource = await F.seedCategory(url());
    await F.seedRule(url(), {
      from: asSource,
      to: F.DEFAULT_CATEGORY,
      conditions: F.ORDERS_GTE_2,
    });
    await refusesWith(asSource, 'user_category_has_rules');
  });

  it('з умовою знижки user_category in [id] → user_category_in_discount', async () => {
    const category = await F.seedCategory(url());
    const group = crypto.randomUUID();
    const discount = crypto.randomUUID();
    await F.rows(
      url(),
      `insert into public.discount_groups (id, name) values ($1, 'Група Е6в')`,
      [group],
    );
    await F.rows(
      url(),
      `insert into public.discounts (id, name, group_id, discount_value) values ($1, 'VIP', $2, 5)`,
      [discount, group],
    );
    await F.rows(
      url(),
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       values ($1, $2, 'user_category', 'in', $3::jsonb)`,
      [crypto.randomUUID(), discount, JSON.stringify([category])],
    );
    await refusesWith(category, 'user_category_in_discount');
  });

  it('batch з однією забороненою → відкат усього batch', async () => {
    const free = await F.seedCategory(url());
    const busy = await F.seedCategory(url());
    await F.seedCustomer(url(), { categoryId: busy });
    await expect(
      removeUserCategoriesOp({ data: [{ id: free }, { id: busy }] }),
    ).rejects.toMatchObject(F.conflict('state', 'user_category_has_customers'));
    expect((await footprint(free)).category).toHaveLength(1);
  });

  it('Review Focus 4: без покупців, але з історією → видалена; історія з NULL і знімком назви', async () => {
    const gone = await F.seedCategory(url());
    const [{ name }] = (await F.rows(
      url(),
      `select name from public.user_categories where id = $1`,
      [gone],
    )) as { name: string }[];
    const customer = await F.seedCustomer(url());
    const assign = (categoryId: string) =>
      assignCustomerCategoryOp({
        data: { userId: customer, categoryId, reason: 'Тест історії' },
      });
    await assign(gone);
    await assign(F.DEFAULT_CATEGORY);

    await expect(
      removeUserCategoriesOp({ data: [{ id: gone }] }),
    ).resolves.toEqual({ count: 1 });
    expect((await footprint(gone)).category).toEqual([]);
    expect(await F.historyOf(url(), customer)).toEqual([
      expect.objectContaining({ to_category_id: null, to_category_name: name }),
      expect.objectContaining({
        from_category_id: null,
        from_category_name: name,
        to_category_id: F.DEFAULT_CATEGORY,
      }),
    ]);
  });
});
