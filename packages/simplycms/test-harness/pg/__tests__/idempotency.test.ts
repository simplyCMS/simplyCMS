// М1 Task 7, І28 і Review Focus 3: Idempotency-Key крізь `handleApiRequest` на
// `languages.add` проти живого Postgres.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ byHeader: new Map<string, unknown>() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(
    async (headers: Headers) =>
      session.byHeader.get(headers.get('x-test-session') ?? '') ?? null,
  ),
}));

import { IDEMPOTENCY_LOCK_TIMEOUT_MS } from 'simplycms/operations';
import { apiHarness } from './fixtures/api-http';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

describe('Idempotency-Key (І28)', () => {
  const db = useAddressingDb('simplycms_idempotency');
  const { call, sessionAs } = apiHarness(session.byHeader);
  const SESSION = { 'x-test-session': 'admin' };
  const langCount = async (code: string) =>
    (await db.q(`select 1 from public.languages where code = $1`, [code]))
      .length;
  const keyRow = async (subjectKey: string, key: string) =>
    (
      await db.q(
        `select status, response, created_at from public.idempotency_keys
          where subject_key = $1 and key = $2`,
        [subjectKey, key],
      )
    )[0];
  /** Токен зі scope `languages.add` для користувача; два токени = дві області. */
  const makeToken = async () => {
    const res = await call(
      'api-tokens.create',
      {
        id: randomUUID(),
        userId: ADMIN.userId,
        name: 't',
        scopes: ['languages.add'],
      },
      SESSION,
    );
    const { token } = (await res.json()) as { token: string };
    const [row] = await db.q(
      `select id from public.api_tokens order by created_at desc limit 1`,
    );
    return {
      headers: { authorization: `Bearer ${token}` },
      id: row!.id as string,
    };
  };

  beforeAll(async () => {
    await db.q(
      `insert into public.users (id, name, email) values ($1, 'a', 'a@x.test')`,
      [ADMIN.userId],
    );
    await db.q(
      `insert into public.user_roles (id, user_id, role) values ($1,$2,'admin')`,
      [randomUUID(), ADMIN.userId],
    );
    sessionAs('admin', ADMIN.userId);
  });

  it('повтор → той самий статус і тіло, мова одна; рядок не placeholder (К5)', async () => {
    const body = { id: randomUUID(), code: 'pl', name: 'Polski' };
    const h = { ...SESSION, 'idempotency-key': 'k-repeat' };
    const first = await call('languages.add', body, h);
    expect(first.status).toBe(200);
    const stored = await keyRow(`user:${ADMIN.userId}`, 'k-repeat');
    expect(stored!.status).toBe(200);
    expect(stored!.response).toEqual(await first.clone().json());
    const again = await call('languages.add', body, h);
    expect(again.status).toBe(200);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(await again.json()).toEqual(await first.json());
    expect(await langCount('pl')).toBe(1);
  });

  it('інший відбиток з тим самим ключем → 422 idempotency_mismatch', async () => {
    const h = { ...SESSION, 'idempotency-key': 'k-mismatch' };
    await call(
      'languages.add',
      { id: randomUUID(), code: 'cs', name: 'Cs' },
      h,
    );
    const res = await call(
      'languages.add',
      { id: randomUUID(), code: 'sk', name: 'Sk' },
      h,
    );
    expect(res.status).toBe(422);
    expect((await res.json()).kind).toBe('idempotency_mismatch');
    expect(await langCount('sk')).toBe(0);
  });

  it('два паралельні запити з одним ключем → обидва 200, однакове тіло, мова одна', async () => {
    const body = { id: randomUUID(), code: 'de', name: 'Deutsch' };
    const h = { ...SESSION, 'idempotency-key': 'k-parallel' };
    const [a, b] = await Promise.all([
      call('languages.add', body, h),
      call('languages.add', body, h),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await a.json()).toEqual(await b.json());
    expect(await langCount('de')).toBe(1);
  });

  it('другий токен того самого користувача — окрема область; 409 не зберігається', async () => {
    const t1 = await makeToken();
    const t2 = await makeToken();
    const body = { id: randomUUID(), code: 'fr', name: 'Fr' };
    const first = await call('languages.add', body, {
      ...t1.headers,
      'idempotency-key': 'k-scope',
    });
    expect(first.status).toBe(200);
    const second = await call(
      'languages.add',
      { ...body, id: randomUUID() },
      { ...t2.headers, 'idempotency-key': 'k-scope' },
    );
    expect(second.status).toBe(409);
    expect((await second.json()).kind).toBe('conflict');
    expect(await keyRow(`token:${t1.id}`, 'k-scope')).toBeDefined();
    expect(await keyRow(`token:${t2.id}`, 'k-scope')).toBeUndefined();
  });

  it('перший запит 400 → виправлене тіло з тим самим ключем виконується', async () => {
    const h = { ...SESSION, 'idempotency-key': 'k-after-400' };
    const bad = await call(
      'languages.add',
      { id: randomUUID(), code: 'NOPE', name: 'x' },
      h,
    );
    expect(bad.status).toBe(400);
    expect(await keyRow(`user:${ADMIN.userId}`, 'k-after-400')).toBeUndefined();
    const fixed = await call(
      'languages.add',
      { id: randomUUID(), code: 'it', name: 'It' },
      h,
    );
    expect(fixed.status).toBe(200);
    expect(await langCount('it')).toBe(1);
  });

  it('рядок старший за 24 год ігнорується й прибирається, разом із порцією протухлих', async () => {
    const subject = `user:${ADMIN.userId}`;
    const stale = (key: string, operation: string) =>
      db.q(
        `insert into public.idempotency_keys (subject_key, operation, key, fingerprint, status, response, created_at)
         values ($1, $2, $3, '\\x00', 200, '{"old":true}', now() - interval '25 hours')`,
        [subject, operation, key],
      );
    await stale('k-stale', 'languages.add');
    await stale('k-other-1', 'languages.fill');
    await stale('k-other-2', 'languages.fill');
    const res = await call(
      'languages.add',
      { id: randomUUID(), code: 'nl', name: 'Nl' },
      { ...SESSION, 'idempotency-key': 'k-stale' },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).not.toEqual({ old: true });
    expect((await keyRow(subject, 'k-stale'))!.response).not.toEqual({
      old: true,
    });
    expect(await keyRow(subject, 'k-other-1')).toBeUndefined();
    expect(await keyRow(subject, 'k-other-2')).toBeUndefined();
  });

  it('утримана перша транзакція: дубль чекає й отримує 409 idempotency_in_flight', async () => {
    const key = 'k-held';
    const release = Promise.withResolvers<void>();
    const held = db.admin(async (tx) => {
      await tx.execute(sql`
        insert into public.idempotency_keys (subject_key, operation, key, fingerprint, status, response)
        values (${`user:${ADMIN.userId}`}, 'languages.add', ${key}, '\\x01', 0, 'null'::jsonb)`);
      await release.promise;
      throw new Error('rollback');
    });
    await new Promise((r) => setTimeout(r, 300));
    const started = Date.now();
    const res = await call(
      'languages.add',
      { id: randomUUID(), code: 'sv', name: 'Sv' },
      { ...SESSION, 'idempotency-key': key },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).kind).toBe('idempotency_in_flight');
    expect(Date.now() - started).toBeGreaterThanOrEqual(
      IDEMPOTENCY_LOCK_TIMEOUT_MS - 500,
    );
    expect(await langCount('sv')).toBe(0);
    release.resolve();
    await expect(held).rejects.toThrow('rollback');
  }, 30_000);

  it('Idempotency-Key поза 1–255 символів → 400', async () => {
    const res = await call(
      'languages.add',
      { id: randomUUID(), code: 'da', name: 'Da' },
      { ...SESSION, 'idempotency-key': 'x'.repeat(256) },
    );
    expect(res.status).toBe(400);
  });
});
