// К3-Е6г (фінальне рев'ю, M1): негативна авторизація операцій покупців і
// дашборду — покупець через РЕАЛЬНИЙ `resolveGrant` отримує AuthzError, а
// пишучі нічого не записують. Пін імені операції ловить підміну права.
import { describe, expect, it, vi } from 'vitest';
import { AuthzError, requireGrant } from 'simplycms/auth';
import * as F from './fixtures/customer-categories';
import { asCustomer } from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  assignCustomerCategoryOp,
  dashboardSummaryOp,
  deleteCustomerOp,
  getCustomerCardOp,
  listCustomersOp,
  setAdminRoleOp,
  setCustomerBanOp,
  updateCustomerContactsOp,
} from 'simplycms/admin-server/impl';

describe('admin: покупець не викликає операції покупців і дашборду (Е6г, M1)', () => {
  const db = F.useCustomersDb('simplycms_admin_cust_authz');
  const url = () => db.url();
  /** Знімок усього, що пишуть операції покупців. */
  const snapshot = async () => ({
    users: await F.rows(url(), 'select * from public.users order by id'),
    profiles: await F.rows(url(), 'select * from public.profiles order by id'),
    roles: await F.rows(url(), 'select * from public.user_roles order by id'),
    history: await F.rows(
      url(),
      'select * from public.user_category_history order by id',
    ),
    sessions: await F.rows(url(), 'select * from public.sessions order by id'),
  });

  it('кожна операція → AuthzError з правильним правом; БД незмінна', async () => {
    const id = await F.seedCustomer(url());
    const categoryId = await F.seedCategory(url());
    const before = await snapshot();
    const ops: Array<[string, string, () => Promise<unknown>]> = [
      [
        'setAdminRole',
        'user.role.assign',
        () => setAdminRoleOp({ data: { userId: id, admin: true } }),
      ],
      [
        'setCustomerBan',
        'customer.manage',
        () => setCustomerBanOp({ data: { userId: id, banned: true } }),
      ],
      [
        'deleteCustomer',
        'customer.delete',
        () =>
          deleteCustomerOp({ data: { userId: id, confirmEmail: 'x@y.test' } }),
      ],
      [
        'updateCustomerContacts',
        'customer.manage',
        () =>
          updateCustomerContactsOp({
            data: {
              userId: id,
              firstName: 'Хакер',
              lastName: null,
              phone: null,
              email: 'hacker@example.test',
            },
          }),
      ],
      [
        'assignCustomerCategory',
        'customer.manage',
        () =>
          assignCustomerCategoryOp({
            data: { userId: id, categoryId, reason: 'x', locked: true },
          }),
      ],
      ['listCustomers', 'customer.manage', () => listCustomersOp({ data: {} })],
      [
        'getCustomerCard',
        'customer.manage',
        () => getCustomerCardOp({ data: { userId: id } }),
      ],
      ['dashboardSummary', 'order.manage', () => dashboardSummaryOp()],
    ];
    for (const [name, operation, run] of ops) {
      asCustomer();
      await expect(run(), name).rejects.toThrow(AuthzError);
      expect(vi.mocked(requireGrant), name).toHaveBeenLastCalledWith(operation);
    }
    expect(await snapshot()).toEqual(before);
  });
});
