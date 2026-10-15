// І27 (юніти): автентифікація запиту `/api/v1` — без БД, з моками меж.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const session = vi.hoisted(() => ({ subject: null as unknown }));
const dbRow = vi.hoisted(() => ({ row: null as unknown }));
const executed = vi.hoisted(() => ({ calls: 0 }));

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(async () => session.subject),
  readUserRoles: vi.fn(async () => ['admin']),
}));
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  asService: vi.fn(async () => dbRow.row),
}));

vi.mock('../execute', () => ({
  executeOperation: vi.fn(async () => ({
    replayed: false,
    output: { ok: true },
  })),
}));

import { defineOperation } from '..';
import { handleApiRequest } from '../http/handle';
import { generateToken } from '../http/token-auth';

const op = defineOperation({
  id: 'test.echo',
  permission: 'settings.manage',
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  async run() {
    executed.calls += 1;
    return { ok: true };
  },
});
const sessionOnlyOp = defineOperation({
  id: 'test.manage',
  permission: 'settings.manage',
  sessionOnly: true,
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  async run() {
    executed.calls += 1;
    return { ok: true };
  },
});
const lookup = (id: string) =>
  [op, sessionOnlyOp].find((o) => o.id === id) as never;

const bearer = () => `Bearer ${generateToken().token}`;
const post = (name: string, headers: Record<string, string> = {}) =>
  handleApiRequest(
    new Request(`https://shop.test/api/v1/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{}',
    }),
    name,
    lookup,
  );
const kindOf = async (res: Response) => (await res.json()).kind;
const tokenRow = (scopes: string[]) => ({ id: 't1', userId: 'u1', scopes });

describe('автентифікація /api/v1 (І27)', () => {
  beforeEach(() => {
    session.subject = null;
    dbRow.row = null;
    executed.calls = 0;
  });

  it('без заголовка й без cookie → 401 unauthenticated', async () => {
    const res = await post('test.echo');
    expect(res.status).toBe(401);
    expect(await kindOf(res)).toBe('unauthenticated');
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('відкликаний/невідомий токен (пошук не знайшов живого) → 401', async () => {
    const res = await post('test.echo', { authorization: bearer() });
    expect(res.status).toBe(401);
  });

  it('Bearer не за форматом → 401 без звернення до БД', async () => {
    const res = await post('test.echo', { authorization: 'Bearer abc' });
    expect(res.status).toBe(401);
  });

  it('невалідний Bearer разом із валідним cookie → 401 (без відкату на сесію)', async () => {
    session.subject = { userId: 'u1', roles: ['admin'] };
    const res = await post('test.echo', { authorization: bearer() });
    expect(res.status).toBe(401);
    expect(executed.calls).toBe(0);
  });

  it('scopes без операції → 403, run не викликається', async () => {
    dbRow.row = tokenRow(['languages.list']);
    const res = await post('test.echo', { authorization: bearer() });
    expect(res.status).toBe(403);
    expect(await kindOf(res)).toBe('forbidden');
    expect(executed.calls).toBe(0);
  });

  it('токен із потрібним scope проходить автентифікацію й права', async () => {
    dbRow.row = tokenRow(['test.echo']);
    const res = await post('test.echo', { authorization: bearer() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('sessionOnly: Bearer → 403, навіть якщо scope дозволяє', async () => {
    dbRow.row = tokenRow(['test.manage']);
    const res = await post('test.manage', { authorization: bearer() });
    expect(res.status).toBe(403);
    expect(executed.calls).toBe(0);
  });

  it('невідома операція → 404 unknown_operation лише після автентифікації', async () => {
    expect((await post('test.nope')).status).toBe(401);
    session.subject = { userId: 'u1', roles: ['admin'] };
    const res = await post('test.nope');
    expect(res.status).toBe(404);
    expect(await kindOf(res)).toBe('unknown_operation');
  });

  it('не POST → 405 з Allow; не JSON → 415', async () => {
    const get = await handleApiRequest(
      new Request('https://shop.test/api/v1/test.echo'),
      'test.echo',
      lookup,
    );
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    session.subject = { userId: 'u1', roles: ['admin'] };
    const res = await post('test.echo', { 'content-type': 'text/plain' });
    expect(res.status).toBe(415);
  });
});
