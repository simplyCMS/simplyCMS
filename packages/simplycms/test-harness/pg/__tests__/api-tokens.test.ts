// М1 Task 7, І27: токени HTTP API проти живого Postgres (адаптер без мережі).
import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ byHeader: new Map<string, unknown>() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  // Сесію Better Auth підмінено заголовком: решта (ролі токена, grants) — справжня.
  readSessionSubject: vi.fn(
    async (headers: Headers) =>
      session.byHeader.get(headers.get('x-test-session') ?? '') ?? null,
  ),
}));

import { subjectFromToken } from 'simplycms/operations/server';
import { apiHarness } from './fixtures/api-http';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

const OTHER_ADMIN = '44444444-4444-4444-8444-444444444444';
const sha = (s: string) => createHash('sha256').update(s).digest();

describe('токени API (І27)', () => {
  const db = useAddressingDb('simplycms_api_tokens');
  const { call, sessionAs } = apiHarness(session.byHeader);

  beforeAll(async () => {
    for (const id of [ADMIN.userId, OTHER_ADMIN]) {
      await db.q(
        `insert into public.users (id, name, email) values ($1, 'a', $2)`,
        [id, `${id}@x.test`],
      );
      await db.q(
        `insert into public.accounts (id, account_id, provider_id, user_id) values ($1,$2::text,'credential',$2::uuid)`,
        [randomUUID(), id],
      );
      await db.q(
        `insert into public.user_roles (id, user_id, role) values ($1,$2,'admin')`,
        [randomUUID(), id],
      );
    }
    sessionAs('admin', ADMIN.userId);
  });

  const createToken = async (
    userId: string,
    scopes: string[],
    extra: Record<string, unknown> = {},
  ) => {
    const res = await call(
      'api-tokens.create',
      { id: randomUUID(), userId, name: 't', scopes, ...extra },
      { 'x-test-session': 'admin' },
    );
    return {
      res,
      token: ((await res.clone().json()) as { token?: string }).token ?? '',
    };
  };
  const serviceAccount = async (role: 'admin' | 'user' = 'admin') => {
    const res = await call(
      'service-accounts.create',
      { name: 'bot', role },
      { 'x-test-session': 'admin' },
    );
    expect(res.status).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  it('у БД лише хеш: token_hash ≠ токен, 32 байти, = sha256', async () => {
    const { res, token } = await createToken(ADMIN.userId, ['languages.list']);
    expect(res.status).toBe(200);
    const [row] = await db.q(
      `select token_hash, token_prefix from public.api_tokens order by created_at desc limit 1`,
    );
    const hash = row!.token_hash as Buffer;
    expect(hash.length).toBe(32);
    expect(hash.equals(sha(token))).toBe(true);
    expect(token).toMatch(/^scms_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain(hash.toString('hex'));
    const list = await call(
      'api-tokens.list',
      {},
      { 'x-test-session': 'admin' },
    );
    expect(JSON.stringify(await list.json())).not.toMatch(
      /token_hash|tokenHash|scms_[0-9a-f]{8}_/,
    );
  });

  it('last_used_at не оновлюється двічі за хвилину', async () => {
    const { token } = await createToken(ADMIN.userId, ['languages.list']);
    const used = async () =>
      (
        await db.q(
          `select last_used_at from public.api_tokens where token_hash = $1`,
          [sha(token)],
        )
      )[0]!.last_used_at as Date | null;
    expect(await used()).toBeNull();
    await subjectFromToken(`Bearer ${token}`);
    const first = await used();
    expect(first).toBeInstanceOf(Date);
    await subjectFromToken(`Bearer ${token}`);
    expect((await used())!.getTime()).toBe(first!.getTime());
    await db.q(
      `update public.api_tokens set last_used_at = now() - interval '2 minutes' where token_hash = $1`,
      [sha(token)],
    );
    await subjectFromToken(`Bearer ${token}`);
    expect((await used())!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('прострочений токен → invalid', async () => {
    const { token } = await createToken(ADMIN.userId, ['languages.list'], {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(await subjectFromToken(`Bearer ${token}`)).toBe('invalid');
  });

  it('відкликаний токен → invalid і 401 на запит', async () => {
    const { token } = await createToken(ADMIN.userId, ['languages.list']);
    expect(await subjectFromToken(`Bearer ${token}`)).not.toBe('invalid');
    const [row] = await db.q(
      `select id from public.api_tokens where token_hash = $1`,
      [sha(token)],
    );
    const rev = await call(
      'api-tokens.revoke',
      { id: row!.id },
      { 'x-test-session': 'admin' },
    );
    expect(rev.status).toBe(200);
    expect(await subjectFromToken(`Bearer ${token}`)).toBe('invalid');
    expect((await call('languages.list', {}, bearer(token))).status).toBe(401);
    // Друге відкликання не пересуває мітку.
    const at = async () =>
      (
        await db.q(`select revoked_at from public.api_tokens where id = $1`, [
          row!.id,
        ])
      )[0]!.revoked_at as Date;
    const before = await at();
    await call(
      'api-tokens.revoke',
      { id: row!.id },
      { 'x-test-session': 'admin' },
    );
    expect((await at()).getTime()).toBe(before.getTime());
  });

  it('токен забороненого (забаненого) власника → invalid', async () => {
    const sa = await serviceAccount();
    const { token } = await createToken(sa, ['languages.list']);
    await db.q(`update public.users set banned_at = now() where id = $1`, [sa]);
    expect(await subjectFromToken(`Bearer ${token}`)).toBe('invalid');
  });

  it('права = роль ∩ scopes', async () => {
    const { token } = await createToken(ADMIN.userId, ['languages.list']);
    expect((await call('languages.list', {}, bearer(token))).status).toBe(200);
    const denied = await call(
      'languages.add',
      { id: randomUUID(), code: 'de', name: 'de' },
      bearer(token),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).kind).toBe('forbidden');
  });

  it('роль користувача звужує токен: scope є, ролі адміна немає → 403', async () => {
    const sa = await serviceAccount('user');
    const { token } = await createToken(sa, ['languages.list']);
    expect((await call('languages.list', {}, bearer(token))).status).toBe(403);
  });

  it('сервісний обліковий запис не має рядка в accounts', async () => {
    const sa = await serviceAccount();
    expect(
      await db.q(`select 1 from public.accounts where user_id = $1`, [sa]),
    ).toHaveLength(0);
    expect(
      await db.q(
        `select 1 from public.user_roles where user_id = $1 and role = 'admin'`,
        [sa],
      ),
    ).toHaveLength(1);
  });

  it("дія атрибутується суб'єкту токена: GUC app.user_id = user_id токена", async () => {
    const sa = await serviceAccount();
    const { token } = await createToken(sa, ['test.whoami']);
    const res = await call('test.whoami', {}, bearer(token));
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe(sa);
  });

  it('apiTokens.create: чужий адмін → 403; власний і сервісний → 200', async () => {
    expect(
      (await createToken(OTHER_ADMIN, ['languages.list'])).res.status,
    ).toBe(403);
    expect(
      (await createToken(ADMIN.userId, ['languages.list'])).res.status,
    ).toBe(200);
    expect(
      (await createToken(await serviceAccount(), ['languages.list'])).res
        .status,
    ).toBe(200);
    expect((await createToken(randomUUID(), [])).res.status).toBe(404);
  });

  it('Bearer зі scope api-tokens.create на api-tokens.create → 403 (лише сесія)', async () => {
    const { token } = await createToken(ADMIN.userId, [
      'api-tokens.create',
      'api-tokens.list',
      'service-accounts.create',
    ]);
    for (const [op, body] of [
      [
        'api-tokens.create',
        { id: randomUUID(), userId: ADMIN.userId, name: 'x', scopes: [] },
      ],
      ['api-tokens.list', {}],
      ['service-accounts.create', { name: 'x', role: 'user' }],
    ] as const) {
      const res = await call(op, body, bearer(token));
      expect(res.status, op).toBe(403);
    }
  });
});
