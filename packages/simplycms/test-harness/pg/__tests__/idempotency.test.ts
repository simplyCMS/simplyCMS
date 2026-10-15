// М1 Task 7, І28 і Review Focus 3: Idempotency-Key крізь `handleApiRequest` на
// `languages.add` проти живого Postgres.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ byHeader: new Map<string, unknown>() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(
    async (headers: Headers) =>
      session.byHeader.get(headers.get('x-test-session') ?? '') ?? null,
  ),
}));

import { advisoryXactLock } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  IDEMPOTENCY_LOCK_TIMEOUT_MS,
  fingerprintOf,
} from 'simplycms/operations';
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

  let savedUrl: string | undefined;
  afterAll(() => {
    // Не лишаємо змінений URL (з `options`) наступним файлам того ж воркера.
    if (savedUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedUrl;
  });

  beforeAll(async () => {
    // Запобіжник тесту: без `lock_timeout` (мутація ж) дубль висів би до таймаута
    // тесту; зі `statement_timeout` на з'єднаннях пулу він падає за секунди. Пул
    // створюється ліниво, тож параметр підхопиться.
    savedUrl = process.env.DATABASE_URL;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('options', '-c statement_timeout=9000');
    process.env.DATABASE_URL = url.toString();
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

  /** Чекає, поки умова в `pg_stat_activity` стане істинною (доказ, що дубль справді чекає). */
  const waitFor = async (where: string) => {
    for (let i = 0; i < 100; i += 1) {
      const rows = await db.q(
        `select 1 from pg_stat_activity where datname = current_database() and ${where}`,
      );
      if (rows.length > 0) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`не дочекались: ${where}`);
  };
  const WAITS_ON_KEY = `wait_event_type = 'Lock' and wait_event in ('transactionid', 'tuple') and query ilike '%idempotency_keys%'`;

  /** Утримує транзакцію з рядком ключа (як незакомічена перша спроба); `done` її завершує. */
  const holdKey = (body: unknown, key: string, commit: boolean) => {
    const release = Promise.withResolvers<void>();
    const held = db.admin(async (tx) => {
      const fp = fingerprintOf(body);
      await tx.execute(sql`
        insert into public.idempotency_keys (subject_key, operation, key, fingerprint, status, response)
        values (${`user:${ADMIN.userId}`}, 'languages.add', ${key}, ${fp}, 0, 'null'::jsonb)`);
      await release.promise;
      if (!commit) throw new Error('rollback');
      await tx.execute(sql`
        update public.idempotency_keys set status = 200, response = '{"held":true}'::jsonb
         where key = ${key}`);
    });
    held.catch(() => undefined);
    return {
      held,
      done: async () => {
        release.resolve();
        await held.catch(() => undefined);
      },
    };
  };

  it('перша транзакція утримана: дубль чекає на PK, після коміту РІВНО одна відповідь — replay', async () => {
    const body = { id: randomUUID(), code: 'hu', name: 'Hu' };
    const h = { ...SESSION, 'idempotency-key': 'k-wait-replay' };
    // Перша спроба — справжній запит: вона блокується на замку мов ПІСЛЯ вставки ключа.
    const lock = Promise.withResolvers<void>();
    const lockHolder = db.admin(async (tx) => {
      await advisoryXactLock(tx, LOCK_KEYS.languagesSet);
      await lock.promise;
    });
    await new Promise((r) => setTimeout(r, 200));
    try {
      const first = call('languages.add', body, h);
      await waitFor(`wait_event_type = 'Lock' and wait_event = 'advisory'`);
      const dup = call('languages.add', body, h);
      await waitFor(WAITS_ON_KEY);
      lock.resolve();
      const [a, b] = await Promise.all([first, dup]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(
        [a, b].filter((r) => r.headers.get('idempotent-replayed') === 'true'),
      ).toHaveLength(1);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect(await b.json()).toEqual(await a.json());
      expect(await langCount('hu')).toBe(1);
    } finally {
      lock.resolve();
      await lockHolder.catch(() => undefined);
    }
  }, 30_000);

  it('перша транзакція відкотилась (не-2xx) → дубль отримує fresh і виконується', async () => {
    const body = { id: randomUUID(), code: 'fi', name: 'Fi' };
    const key = 'k-wait-rollback';
    const holder = holdKey(body, key, false);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const dup = call('languages.add', body, {
        ...SESSION,
        'idempotency-key': key,
      });
      await waitFor(WAITS_ON_KEY);
      await holder.done();
      const res = await dup;
      expect(res.status).toBe(200);
      expect(res.headers.get('idempotent-replayed')).toBeNull();
      expect(await langCount('fi')).toBe(1);
    } finally {
      await holder.done();
    }
  }, 30_000);

  it('утримана перша транзакція: дубль чекає й отримує 409 idempotency_in_flight', async () => {
    const key = 'k-held';
    const holder = holdKey({ x: 1 }, key, false);
    try {
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
    } finally {
      await holder.done();
    }
  }, 30_000);

  it('ті самі ключі тіла в іншому порядку → replay, не 422', async () => {
    const id = randomUUID();
    const h = { ...SESSION, 'idempotency-key': 'k-order' };
    const first = await call(
      'languages.add',
      { id, code: 'ro', name: 'Ro' },
      h,
    );
    expect(first.status).toBe(200);
    const again = await call(
      'languages.add',
      { name: 'Ro', code: 'ro', id },
      h,
    );
    expect(again.status).toBe(200);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
  });

  it('прибирання протухлих не чекає на рядки конкурента: чужий ключ не дає хибного 409', async () => {
    const subject = `user:${ADMIN.userId}`;
    await db.q(
      `insert into public.idempotency_keys (subject_key, operation, key, fingerprint, status, response, created_at)
       values ($1, 'languages.fill', 'k-locked-stale', '\\x00', 200, '{}', now() - interval '25 hours')`,
      [subject],
    );
    const release = Promise.withResolvers<void>();
    const holder = db.admin(async (tx) => {
      await tx.execute(
        sql`select 1 from public.idempotency_keys where key = 'k-locked-stale' for update`,
      );
      await release.promise;
    });
    try {
      await new Promise((r) => setTimeout(r, 300));
      const started = Date.now();
      const res = await call(
        'languages.add',
        { id: randomUUID(), code: 'no', name: 'No' },
        { ...SESSION, 'idempotency-key': 'k-prune-free' },
      );
      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(IDEMPOTENCY_LOCK_TIMEOUT_MS);
    } finally {
      release.resolve();
      await holder.catch(() => undefined);
    }
  }, 30_000);

  it('Idempotency-Key поза 1–255 символів → 400', async () => {
    const res = await call(
      'languages.add',
      { id: randomUUID(), code: 'da', name: 'Da' },
      { ...SESSION, 'idempotency-key': 'x'.repeat(256) },
    );
    expect(res.status).toBe(400);
  });

  it('вихід не за схемою, без ключа: 500 і зміна відкочена (рядка немає)', async () => {
    const key = `bad-out-${randomUUID()}`;
    const res = await call('test.badOutput', { key }, SESSION);
    expect(res.status).toBe(500);
    expect((await res.json()).kind).toBe('internal');
    expect(
      await db.q(`select 1 from public.system_settings where key = $1`, [key]),
    ).toHaveLength(0);
  });
});
