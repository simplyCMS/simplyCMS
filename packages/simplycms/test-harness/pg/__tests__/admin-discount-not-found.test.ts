// Р26: `getDiscount` для відсутнього id кидає доменне «не знайдено» (член
// родини `DOMAIN_ERROR_NAME`), а не plain `Error` — інакше картка не
// відрізнить його від збою БД.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/admin-discounts';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { getDiscountOp } from 'simplycms/admin-server/impl';

describe('admin: getDiscount — відсутня знижка (Р26)', () => {
  F.useDiscountsAdminDb('simplycms_admin_discount_not_found');

  it('невідомий id → доменна помилка NotFoundError', async () => {
    await expect(
      getDiscountOp({ data: { id: crypto.randomUUID() } }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
