// Журнал накату (К3-Е8, Е8-Р2): база зі схемою, але без журналу, накату не
// піддається; `readJournal` читає журнал з рантайм-підключення лише через
// `SET LOCAL ROLE app_admin` — прямого права `app_runtime` не має.
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  readJournal,
  UnjournaledDatabaseError,
} from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { applySqlFiles, queryRows, withUser } from '../apply.mjs';
import {
  CANON_DIR,
  canonCopy,
  canonNames,
  exists,
  freshDb,
  numberOf,
} from './fixtures/migrate';

const TABLES = `select count(*)::int as n from information_schema.tables
  where table_schema = 'public'`;

describe('журнал simplycms_migrations', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('схема без журналу → UnjournaledDatabaseError з підказкою, нічого не змінено', async () => {
    const db = await freshDb(harness.url);
    try {
      // Накат повз журнал — рівно та «адопція», яку накат відмовляється вгадувати.
      await applySqlFiles(
        db.url,
        canonNames().map((name) => join(CANON_DIR, name)),
      );
      const before = await numberOf(db.url, TABLES);

      const err = await applyMigrations({
        connectionString: db.url,
        dir: CANON_DIR,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnjournaledDatabaseError);
      expect((err as Error).message).toContain(
        'перестворіть базу (`pnpm db:demo` локально); адопція бази без журналу не підтримується',
      );
      expect(await exists(db.url, 'public.simplycms_migrations')).toBe(false);
      expect(await numberOf(db.url, TABLES)).toBe(before);
      // Журналу немає — читач каже це `null`, а не порожнім списком.
      expect(await readJournal(withUser(db.url, 'app_runtime'))).toBeNull();
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('readJournal під app_runtime читає рядки; прямий select — permission denied', async () => {
    const db = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      const runtime = withUser(db.url, 'app_runtime');

      const rows = await readJournal(runtime);
      expect(rows?.map((row) => row.name)).toEqual(canonNames());
      for (const row of rows ?? []) {
        expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        expect(row.appliedAt).toBeInstanceOf(Date);
      }

      await expect(
        queryRows(runtime, 'select name from public.simplycms_migrations'),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('накат упав посередині → рядки, що встигли, читаються під app_runtime', async () => {
    // Вікно гранту: журнал створено, грант `app_admin` ставиться після накату;
    // без гранту й на шляху падіння `readJournal` кидав би 42501.
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      copy.write('0006_b.sql', 'select * from public.no_such_table;');
      await expect(
        applyMigrations({ connectionString: db.url, dir: copy.dir }),
      ).rejects.toThrow(/0006_b\.sql/);
      const rows = await readJournal(withUser(db.url, 'app_runtime'));
      expect(rows?.map((row) => row.name)).toEqual(canonNames());
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);

  // Бюджет `timeoutMs` має діяти на ОБИДВІ фази: запит (statement_timeout сесії)
  // і з'єднання (connectionTimeoutMillis). Негативний контроль: без параметра
  // читач чекав би на лок безкінечно.
  it('readJournal({ timeoutMs }): запит за блокованою таблицею — statement timeout (57014)', async () => {
    const db = await freshDb(harness.url);
    const holder = new pg.Client({ connectionString: db.url });
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      await holder.connect();
      await holder.query('begin');
      await holder.query(
        'lock table public.simplycms_migrations in access exclusive mode',
      );
      // Власна межа 5 с, а не таймаут vitest: без `statement_timeout` читач
      // висить на локу, і негативний контроль має падати швидко, а не за 120 с.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        readJournal(withUser(db.url, 'app_runtime'), { timeoutMs: 400 }).then(
          () => 'resolved',
          (error: unknown) => error,
        ),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve('завис довше 5 с'), 5_000);
        }),
      ]);
      clearTimeout(timer);
      expect(outcome).toMatchObject({ code: '57014' });
    } finally {
      await holder.query('rollback').catch(() => {});
      await holder.end();
      await db.drop();
    }
  }, 120_000);

  it("readJournal({ timeoutMs }): сервер, що приймає TCP і мовчить, — timeout з'єднання", async () => {
    const sockets = new Set<Socket>();
    const silent = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
    });
    await new Promise<void>((resolve) =>
      silent.listen(0, '127.0.0.1', resolve),
    );
    const { port } = silent.address() as { port: number };
    try {
      await expect(
        readJournal(`postgres://app_runtime@127.0.0.1:${port}/db`, {
          timeoutMs: 300,
        }),
      ).rejects.toThrow(/timeout/i);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => silent.close(resolve));
    }
  }, 30_000);
});
