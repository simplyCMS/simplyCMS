// К3-Е6г, Task 4 (Е6г-3): «наступний запит». Ролі НЕ лежать у токені сесії —
// після зняття ролі та сама cookie вже не дає admin.access, guard не змінюється.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AuthzError,
  getAuth,
  readSessionSubject,
  requireGrant,
  resetAuth,
} from 'simplycms/auth';
import * as F from './fixtures/customer-categories';

const req = vi.hoisted(() => ({ cookie: '' }));
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: vi.fn(),
  getRequest: () => ({ headers: new Headers({ cookie: req.cookie }) }),
}));

import { setAdminRoleOp } from 'simplycms/admin-server/impl';

describe('admin: зняття ролі діє з наступного запиту (Е6г-3)', () => {
  const db = F.useCustomersDb('simplycms_admin_roles_session');
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const signUp = async (email: string) => {
    const response = await getAuth().api.signUpEmail({
      body: { email, password: 'roles-session-password', name: 'Адмін Е6г' },
      asResponse: true,
    });
    expect(response.status, await response.clone().text()).toBe(200);
    cookies[email] = response.headers
      .getSetCookie()
      .map((raw) => raw.split(';')[0])
      .join('; ');
    const subject = await readSessionSubject(
      new Headers({ cookie: cookies[email] }),
    );
    ids[email] = subject!.userId;
    await F.rows(
      db.url(),
      `insert into public.user_roles (id, user_id, role) values ($1, $2, 'admin')`,
      [crypto.randomUUID(), ids[email]],
    );
  };

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'roles-session-secret-not-a-real-one';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    resetAuth();
    await signUp('a@example.test');
    await signUp('b@example.test');
  });
  afterAll(() => {
    resetAuth();
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
  });

  it('після зняття ролі сесія B живе, але roles без admin, а admin.access → AuthzError', async () => {
    req.cookie = cookies['b@example.test']!;
    await expect(requireGrant('admin.access')).resolves.toMatchObject({
      scope: 'any',
    });

    req.cookie = cookies['a@example.test']!;
    await expect(
      setAdminRoleOp({
        data: { userId: ids['b@example.test']!, admin: false },
      }),
    ).resolves.toEqual({ isAdmin: false });

    req.cookie = cookies['b@example.test']!;
    const subject = await readSessionSubject(
      new Headers({ cookie: req.cookie }),
    );
    expect(subject?.userId).toBe(ids['b@example.test']);
    expect(subject?.roles).not.toContain('admin');
    await expect(requireGrant('admin.access')).rejects.toBeInstanceOf(
      AuthzError,
    );
  });
});
