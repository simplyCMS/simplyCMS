// К3-Е6в, Task 6: лічильник покупців за категоріями (Task 9) і вузький пошук
// покупця для діагностики ціни (Task 10), `customer.manage`.
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
  countCustomersByCategoryOp,
  findCustomersOp,
} from 'simplycms/admin-server/impl';

describe('admin: лічильник і пошук покупців (Е6в, Task 6)', () => {
  const db = F.useCustomersDb('simplycms_admin_customer_lookup');
  const url = () => db.url();

  it('countCustomersByCategory: профіль без категорії рахується в дефолтну; порожня категорія — 0', async () => {
    const empty = await F.seedCategory(url());
    const before = await countCustomersByCategoryOp();
    const of = (list: typeof before, id: string) =>
      list.find((r) => r.categoryId === id)?.customers;
    await F.seedCustomer(url(), { categoryId: null });
    const after = await countCustomersByCategoryOp();
    expect(of(after, F.DEFAULT_CATEGORY)).toBe(
      of(before, F.DEFAULT_CATEGORY)! + 1,
    );
    expect(of(after, empty)).toBe(0);
  });

  it('findCustomers: за email, з категорією (NULL → дефолтна); wildcard — літерал', async () => {
    const email = `find_me-${crypto.randomUUID().slice(0, 6)}@shop.test`;
    const userId = await F.seedCustomer(url(), { email });
    await expect(
      findCustomersOp({ data: { query: email.slice(0, 12) } }),
    ).resolves.toEqual([
      { userId, email, name: null, categoryName: 'Роздріб' },
    ]);
    await expect(findCustomersOp({ data: { query: '%%' } })).resolves.toEqual(
      [],
    );
    await expect(
      findCustomersOp({ data: { query: 'a' } }),
    ).rejects.toMatchObject(F.invalid);
  });
});
