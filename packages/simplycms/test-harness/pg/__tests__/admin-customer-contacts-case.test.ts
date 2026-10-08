// К3-Е6г (фінальне рев'ю, m2): зайнятість email порівнюється по `lower(email)`
// з ОБОХ боків. Чужий покупець засіяний прямим SQL зі змішаним регістром
// (BA такого не пише, але `users_email_key` регістр-чутливий) — без `lower()`
// у перевірці зайнятості дубль пройшов би.
import { describe, expect, it, vi } from 'vitest';
import * as C from './fixtures/customer-contacts';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { updateCustomerContactsOp } from 'simplycms/admin-server/impl';

describe('admin: зайнятість email не залежить від регістру збереженого', () => {
  const db = F.useCustomersDb('simplycms_admin_contacts_case');
  const url = () => db.url();
  const { user } = C.contactHelpers(url);

  it('чужий Buyer@Shop.test, подано buyer@shop.test → taken, email не змінено', async () => {
    await F.seedCustomer(url(), { email: 'Buyer@Shop.test' });
    const id = await F.seedCustomer(url(), { email: 'mine@x.test' });
    await expect(
      updateCustomerContactsOp({
        data: {
          userId: id,
          firstName: 'Іван',
          lastName: null,
          phone: null,
          email: 'buyer@shop.test',
        },
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      issues: [{ path: ['email'], code: 'taken' }],
    });
    expect(await user(id)).toMatchObject({ email: 'mine@x.test' });
  });
});
