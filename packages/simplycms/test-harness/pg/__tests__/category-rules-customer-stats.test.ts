// К3-Е6в, Task 6, fix round 1 (рев'ю): статистика покупця наскрізь.
// Домен email — з `users.email` (не з копії в `profiles`), провайдери — з
// УСІХ рядків `accounts`, сума замовлень — `numeric` → число.
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { applyCategoryRules, loadCustomerStats } from 'simplycms/commerce';
import * as F from './fixtures/customer-categories';

describe('автоправила: статистика покупця з БД (Е6в-19)', () => {
  const db = F.useCustomersDb('simplycms_rules_customer_stats');
  const url = () => db.url();
  const asAdmin = <T>(fn: Parameters<typeof withActor<T>>[1]) =>
    withActor({ role: 'app_admin' }, fn);

  it('users.email ≠ profiles.email, accounts credential + google, сума 1500.50 → статистика й правило з трьох умов', async () => {
    const from = await F.seedCategory(url());
    const to = await F.seedCategory(url());
    const customer = await F.seedCustomer(url(), {
      categoryId: from,
      email: 'buyer@users-domain.test',
    });
    await F.rows(
      url(),
      `update public.profiles set email = 'buyer@profile-domain.test' where user_id = $1`,
      [customer],
    );
    for (const provider of ['credential', 'google'])
      await F.rows(
        url(),
        `insert into public.accounts (id, account_id, provider_id, user_id)
         values ($1, $2, $3, $4)`,
        [crypto.randomUUID(), `${provider}-acc`, provider, customer],
      );
    await F.rows(
      url(),
      `insert into public.orders (id, user_id, order_number, first_name, last_name,
         email, phone, payment_method, subtotal, total)
       values ($1, $2, 'E6V-STATS-1', 'Т', 'П', 'buyer@users-domain.test',
         '+380000000000', 'cash', 1500.50, 1500.50)`,
      [crypto.randomUUID(), customer],
    );

    const stats = await asAdmin((tx) =>
      loadCustomerStats(tx, customer, new Date()),
    );
    expect(stats).toMatchObject({
      emailDomain: 'users-domain.test',
      totalPurchases: 1500.5,
      ordersCount: 1,
    });
    expect([...stats!.authProviders].sort()).toEqual(['credential', 'google']);

    const rule = (field: string, operator: string, value: string) => ({
      field,
      operator,
      value,
    });
    await F.seedRule(url(), {
      from,
      to,
      conditions: {
        type: 'all',
        rules: [
          rule('email_domain', '=', 'users-domain.test'),
          rule('auth_provider', '=', 'google'),
          rule('total_purchases', '>=', '1500.5'),
        ],
      },
    });
    expect(await asAdmin((tx) => applyCategoryRules(tx, customer))).toBe(
      'changed',
    );
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: to,
    });
  });
});
