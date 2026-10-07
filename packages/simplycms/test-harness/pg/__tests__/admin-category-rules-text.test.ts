// Фінальне рев'ю К3-Е6в, F7: текстові умови автоправил нормалізуються на
// записі сервером (`trim` + нижній регістр — у БД лежить канонічна форма,
// хоч би що надіслав клієнт) і при порівнянні рушієм (email покупця з
// великими літерами збігається з умовою).
import { describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { applyCategoryRules } from 'simplycms/commerce';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { categoryRulesOps } from 'simplycms/admin-server/impl';

const conditions = (value: string) => ({
  type: 'all',
  rules: [{ field: 'email_domain', operator: '=', value }],
});

describe('admin: текстові умови автоправил нормалізуються (F7)', () => {
  const db = F.useCustomersDb('simplycms_admin_category_rules_text');
  const url = () => db.url();
  const stored = async (id: string) =>
    (
      await F.rows(
        url(),
        `select conditions from public.category_rules where id = $1`,
        [id],
      )
    )[0]!.conditions;

  it('insert і update пишуть канонічну форму; рушій переводить покупця з email у верхньому регістрі', async () => {
    const from = await F.seedCategory(url());
    const to = await F.seedCategory(url());
    const id = crypto.randomUUID();
    await categoryRulesOps.insert({
      data: [
        {
          id,
          name: 'Домен',
          fromCategoryId: from,
          toCategoryId: to,
          conditions: conditions(' Shop-Domain.TEST '),
        },
      ] as never,
    });
    expect(await stored(id)).toEqual(conditions('shop-domain.test'));

    await categoryRulesOps.update({
      data: [{ id, patch: { conditions: conditions('Buyer-Domain.Test ') } }],
    });
    expect(await stored(id)).toEqual(conditions('buyer-domain.test'));

    const customer = await F.seedCustomer(url(), {
      categoryId: from,
      email: 'Someone@BUYER-Domain.test',
    });
    await expect(
      withActor({ role: 'app_admin' }, (tx) =>
        applyCategoryRules(tx, customer),
      ),
    ).resolves.toBe('changed');
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: to,
    });
  });
});
