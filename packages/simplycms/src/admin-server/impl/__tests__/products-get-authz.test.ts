import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setResponseStatus } from '@tanstack/react-start/server';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  subjectFromCookie: vi.fn(async () => ({ userId: 'u1', roles: ['user'] })),
}));

import { AuthzError } from 'simplycms/auth';
import { productsGet } from 'simplycms/admin-server/impl';
import { invokeFromServerFn } from '../../../operations/server';

// Покупець із cookie-сесією не читає агрегат товару (права — до БД).
describe('products.get через serverFn', () => {
  beforeEach(() => vi.mocked(setResponseStatus).mockClear());

  it('покупець → AuthzError і статус 403', async () => {
    await expect(
      invokeFromServerFn(productsGet, {
        id: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(AuthzError);
    expect(setResponseStatus).toHaveBeenCalledWith(403);
  });
});
