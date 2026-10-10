// К3-Е6д, Task 3: покупець не викликає операції банерів — РЕАЛЬНИЙ
// `resolveGrant`, пін імені права `banner.manage`, БД незмінна.
import { describe, expect, it, vi } from 'vitest';
import { AuthzError, requireGrant } from 'simplycms/auth';
import { bannersOps } from 'simplycms/admin-server/impl';
import { asCustomer } from './fixtures/admin-system';
import { useBannersDb } from './fixtures/admin-banners';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: покупець не керує банерами (Е6д, Task 3)', () => {
  const t = useBannersDb('simplycms_e6d_banners_authz');

  it('list/insert/update/remove → AuthzError з banner.manage; БД незмінна', async () => {
    const id = await t.insert();
    const before = await t.snapshot();
    const ops: Array<[string, () => Promise<unknown>]> = [
      ['list', () => bannersOps.list({ data: {} })],
      [
        'insert',
        () =>
          bannersOps.insert({
            data: [{ id: crypto.randomUUID(), title: 'X', imageUrl: 'u' }],
          }),
      ],
      [
        'update',
        () => bannersOps.update({ data: [{ id, patch: { title: 'Хак' } }] }),
      ],
      ['remove', () => bannersOps.remove({ data: [{ id }] })],
    ];
    for (const [name, run] of ops) {
      asCustomer();
      await expect(run(), name).rejects.toThrow(AuthzError);
      expect(vi.mocked(requireGrant), name).toHaveBeenLastCalledWith(
        'banner.manage',
      );
    }
    expect(await t.snapshot()).toEqual(before);
  });
});
