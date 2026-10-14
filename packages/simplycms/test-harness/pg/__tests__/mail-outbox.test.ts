// К3-Е8, Task 10 (Е8-Р10): outbox пошти `mail_outbox` проти живої БД.
// Транспорт — фейк: Mailpit тут не потрібен, доводимо чергу, а не SMTP.
import { sql } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import {
  MAIL_RETRY_BATCH,
  deliverMail,
  enqueueMail,
  listMailOutbox,
  retryMail,
  scheduleMail,
  type MailMessage,
  type MailTransport,
} from 'simplycms/mail';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { blockCommitOn } from './fixtures/commit-block';

const SECRET_BODY = 'https://shop.test/reset?token=TOP-SECRET-TOKEN';
const msg = (to: string): MailMessage => ({
  to,
  subject: 'Тема',
  text: `Посилання: ${SECRET_BODY}`,
  kind: 'password_reset',
});

type Row = { id: string; attempts: number; last_error: string | null };

describe('outbox пошти mail_outbox (Е8-Р10)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_e8_mail_outbox');
  let dbUrl = '';

  /** Фейк-транспорт: збирає надіслане, падає з `failWith`, якщо задано. */
  let failWith: Error | null = null;
  const sent: MailMessage[] = [];
  const fake: MailTransport = {
    driver: 'log',
    send: async (m) => {
      if (failWith) throw failWith;
      sent.push(m);
    },
  };
  const rows = () =>
    queryRows(
      dbUrl,
      `select id, attempts, last_error from public.mail_outbox order by requested_at`,
    ) as Promise<Row[]>;
  const enqueue = (to: string) =>
    withActor({ role: 'app_admin' }, (db) =>
      enqueueMail(db, [{ kind: 'password_reset', message: msg(to) }]),
    );

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  beforeEach(async () => {
    failWith = null;
    sent.length = 0;
    await queryRows(dbUrl, 'delete from public.mail_outbox');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('успіх → лист надіслано, рядка в outbox немає', async () => {
    const ids = await enqueue('a@x.test');
    expect(await rows()).toHaveLength(1);
    await deliverMail(ids, fake);
    expect(sent.map((m) => m.to)).toEqual(['a@x.test']);
    expect(await rows()).toEqual([]);
  });

  it('🔴 збій → attempts = 1, last_error без тексту листа, не кинуло', async () => {
    const ids = await enqueue('b@x.test');
    failWith = new Error('smtp down');
    await expect(deliverMail(ids, fake)).resolves.toBeUndefined();
    const [row] = await rows();
    expect(row).toMatchObject({ id: ids[0], attempts: 1 });
    expect(row!.last_error).toContain('smtp down');
    expect(row!.last_error).not.toContain('TOP-SECRET-TOKEN');
    expect(row!.last_error).not.toContain('b@x.test');
  });

  it('🔴 last_error не містить адреси отримувача з тексту помилки драйвера', async () => {
    const ids = await enqueue('who.am-i+tag@x.test');
    failWith = new Error(
      '550 rejected RCPT who.am-i+tag@x.test (no such user)',
    );
    await deliverMail(ids, fake);
    const [row] = await rows();
    expect(row!.last_error).not.toContain('who.am-i');
    expect(row!.last_error).not.toContain('x.test');
    expect(row!.last_error).toContain('<email>');
  });

  it('🔴 last_error маскує userinfo URL і обрізається до 500 символів', async () => {
    const ids = await enqueue('c@x.test');
    failWith = new Error(
      `connect smtp://u:P4SS@h:587 failed ${'x'.repeat(800)}`,
    );
    await deliverMail(ids, fake);
    const [row] = await rows();
    expect(row!.last_error).not.toContain('P4SS');
    expect(row!.last_error).toContain('smtp://***@h:587');
    expect(row!.last_error!.length).toBeLessThanOrEqual(500);
  });

  it('🔴 scheduleMail кидає, коли запис у таблицю неможливий', async () => {
    await queryRows(
      dbUrl,
      `create or replace function public.e8_mail_fail() returns trigger
         language plpgsql as $$ begin raise exception 'outbox down'; end $$`,
    );
    await queryRows(
      dbUrl,
      `create trigger e8_mail_fail before insert on public.mail_outbox
         for each row execute function public.e8_mail_fail()`,
    );
    try {
      await expect(
        scheduleMail([{ kind: 'owner_invite', message: msg('d@x.test') }]),
      ).rejects.toThrow();
    } finally {
      await queryRows(dbUrl, 'drop trigger e8_mail_fail on public.mail_outbox');
      await queryRows(dbUrl, 'drop function public.e8_mail_fail()');
    }
    expect(await rows()).toEqual([]);
  });

  it('scheduleMail ставить рядок власною транзакцією', async () => {
    const ids = await scheduleMail([
      { kind: 'owner_invite', message: msg('e@x.test') },
    ]);
    expect((await rows()).map((r) => r.id)).toEqual(ids);
  });

  it('🔴 deliverMail після ROLLBACK транзакції-власниці нічого не надсилає', async () => {
    const unblock = await blockCommitOn(
      (q) => queryRows(dbUrl, q),
      'mail_outbox',
      'insert',
    );
    let ids: string[] = [];
    try {
      await expect(
        withActor({ role: 'app_admin' }, async (db) => {
          ids = await enqueueMail(db, [
            { kind: 'order_customer', message: msg('f@x.test') },
          ]);
        }),
      ).rejects.toThrow();
    } finally {
      await unblock();
    }
    expect(ids).toHaveLength(1);
    await deliverMail(ids, fake);
    expect(sent).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it('добір: два старі хвости + новий лист → надіслано три', async () => {
    const old = [
      ...(await enqueue('o1@x.test')),
      ...(await enqueue('o2@x.test')),
    ];
    await queryRows(
      dbUrl,
      `update public.mail_outbox set requested_at = now() - interval '2 minutes'`,
    );
    const fresh = await enqueue('n@x.test');
    await deliverMail(fresh, fake);
    expect(sent.map((m) => m.to).sort()).toEqual([
      'n@x.test',
      'o1@x.test',
      'o2@x.test',
    ]);
    expect(old).toHaveLength(2);
    expect(await rows()).toEqual([]);
  });

  it("🔴 добір обмежений MAIL_RETRY_BATCH: шість старих хвостів → п'ять надіслано", async () => {
    for (let i = 1; i <= 6; i++) await enqueue(`q${i}@x.test`);
    await queryRows(
      dbUrl,
      `update public.mail_outbox set requested_at = now() - interval '2 minutes'`,
    );
    await deliverMail([], fake);
    expect(sent).toHaveLength(MAIL_RETRY_BATCH);
    expect(await rows()).toHaveLength(1);
  });

  // Бронь `requested_at = now()` у claim: доки перший виклик шле лист, другий
  // не бере той самий хвіст, тож лист не дублюється. Без таймінгів: перший
  // `send` стоїть на бар'єрі, і тест відпускає його лише ПІСЛЯ того, як
  // другий `deliverMail` повністю завершив свій claim (і весь добір).
  it('🔴 два паралельні добори старого хвоста → один send', async () => {
    await enqueue('dup@x.test');
    await queryRows(
      dbUrl,
      `update public.mail_outbox set requested_at = now() - interval '2 minutes'`,
    );
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const firstInSend = new Promise<void>((resolve) => (entered = resolve));
    let calls = 0;
    const gated: MailTransport = {
      driver: 'log',
      send: async (m) => {
        calls += 1;
        // Лише перший виклик чекає; решта (якщо бронь зламана) проходить одразу.
        if (calls === 1) {
          entered();
          await barrier;
        }
        sent.push(m);
      },
    };
    const first = deliverMail([], gated);
    await firstInSend;
    await deliverMail([], gated);
    release();
    await first;
    expect(sent.map((m) => m.to)).toEqual(['dup@x.test']);
    expect(await rows()).toEqual([]);
  });

  it('свіжий хвіст опортуністично НЕ чіпається, retryMail його бере', async () => {
    await enqueue('s@x.test');
    const fresh = await enqueue('t@x.test');
    await deliverMail(fresh, fake);
    expect(sent.map((m) => m.to)).toEqual(['t@x.test']);
    await expect(retryMail(5, fake)).resolves.toEqual({ sent: 1, failed: 0 });
    expect(await rows()).toEqual([]);
  });

  it('retryMail після відновлення SMTP доставляє й видаляє; збій рахує спробу', async () => {
    const ids = await enqueue('r@x.test');
    failWith = new Error('smtp down');
    await expect(retryMail(5, fake)).resolves.toEqual({ sent: 0, failed: 1 });
    expect((await rows())[0]).toMatchObject({ id: ids[0], attempts: 1 });
    failWith = null;
    await expect(retryMail(5, fake)).resolves.toEqual({ sent: 1, failed: 0 });
    expect(await rows()).toEqual([]);
  });

  it('🔴 listMailOutbox: рядки без поля message', async () => {
    const ids = await enqueue('l@x.test');
    failWith = new Error('smtp down');
    await deliverMail(ids, fake);
    const list = await withActor({ role: 'app_admin' }, (db) =>
      listMailOutbox(db),
    );
    expect(list).toHaveLength(1);
    expect(Object.keys(list[0]!).sort()).toEqual([
      'attempts',
      'id',
      'kind',
      'lastError',
      'requestedAt',
    ]);
    expect(list[0]!.requestedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(list)).not.toContain('TOP-SECRET-TOKEN');
  });

  it('🔴 app_user не бачить outbox: permission denied', async () => {
    await expect(
      withActor({ role: 'app_user' }, (db) =>
        db.execute(sql`select * from public.mail_outbox`),
      ),
    ).rejects.toMatchObject({
      cause: {
        code: '42501',
        message: expect.stringContaining('permission denied'),
      },
    });
  });

  it('id генерує викликач: вставка без id відхиляється (Категорія A)', async () => {
    await expect(
      queryRows(
        dbUrl,
        `insert into public.mail_outbox (kind, message) values ('owner_invite', '{}')`,
      ),
    ).rejects.toThrow();
  });
});
