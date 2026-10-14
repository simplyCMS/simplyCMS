import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  CONNECT_TIMEOUT_MS,
  runOnlineChecks,
} from '../packages/cli/src/doctor-db-checks.mjs';
import { isCoreMigrationName } from '../packages/simplycms/src/migrate/files';

// `doctor --online` без живої БД: ядро й зонд підміняються ін'єкцією.

describe('cli doctor --online', () => {
  const URL_WITH_PASSWORD = 'postgresql://app_runtime:hunter2@db:5432/shop';
  const ctx = {
    storeRoot: '/store',
    env: { DATABASE_URL: URL_WITH_PASSWORD },
  };
  const files = [
    { name: '0001_init.sql', path: '/p', checksum: 'a' },
    { name: '0005_x.sql', path: '/p', checksum: 'b' },
  ];
  const row = (name: string, checksum: string) => ({
    name,
    checksum,
    appliedAt: new Date(),
  });
  const pendingMigrations = (
    rows: { name: string; checksum: string }[],
    list: typeof files,
  ) => {
    const done = new Map(rows.map((r) => [r.name, r.checksum]));
    return {
      pending: list.filter((f) => !done.has(f.name)).map((f) => f.name),
      changed: list
        .filter((f) => done.has(f.name) && done.get(f.name) !== f.checksum)
        .map((f) => f.name),
    };
  };
  const core = (journal: unknown, foreign: string[] = []) => ({
    listMigrationFiles: () => files,
    readJournal: async () => journal,
    readStoreFacts: async () => ({
      owners: 1,
      profile: { name: 'Shop', email: 'shop@example.com' },
      failedMail: 0,
    }),
    pendingMigrations,
    isCoreMigrationName,
    findForeignDatabases: async () => foreign,
  });
  type Row = { id: string; status: string; details?: string };
  const byId = (checks: Row[]) =>
    Object.fromEntries(checks.map((c) => [c.id, c])) as Record<string, Row>;
  const reachable = async () => {};

  it('є ненакочені → migrations-journal = warn з іменем файлу', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'a')]),
      }),
    );
    expect(checks['db-reachable']!.status).toBe('ok');
    expect(checks['migrations-journal']!.status).toBe('warn');
    expect(checks['migrations-journal']!.details).toContain('0005_x.sql');
  });

  it('усе накочено → ok', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'a'), row('0005_x.sql', 'b')]),
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('ok');
  });

  it('змінений накочений файл → error', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'OTHER'), row('0005_x.sql', 'b')]),
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).toContain('0001_init.sql');
    expect(checks['migrations-journal']!.details).toContain(
      'baseline платформи змінився',
    );
  });

  it('журналу немає (null) → error «база без журналу»', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, { probe: reachable, core: core(null) }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).toContain('база без журналу');
  });

  it('shared-cluster: чужих баз немає → ok', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, { probe: reachable, core: core([]) }),
    );
    expect(checks['shared-cluster']!.status).toBe('ok');
  });

  it('shared-cluster: є чужі бази → warn з іменами, текстом про окремий екземпляр і без пароля', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([], ['other_shop', 'staging']),
      }),
    );
    const c = checks['shared-cluster']!;
    expect(c.status).toBe('warn');
    expect(c.details).toContain('other_shop, staging');
    expect(c.details).toContain('окремий екземпляр Postgres');
    expect(c.details).not.toContain('hunter2');
  });

  it('shared-cluster: findForeignDatabases отримує бюджет timeoutMs (3 с), як readJournal', async () => {
    const findForeignDatabases = vi.fn(async () => [] as string[]);
    await runOnlineChecks(ctx, {
      probe: reachable,
      core: { ...core([]), findForeignDatabases },
    });
    expect(findForeignDatabases).toHaveBeenCalledWith(URL_WITH_PASSWORD, {
      timeoutMs: CONNECT_TIMEOUT_MS,
    });
  });

  it('shared-cluster: помилка запиту → error без пароля; БД недоступна → skip', async () => {
    const failing = {
      ...core([]),
      findForeignDatabases: async () => {
        throw new Error(`permission denied ${URL_WITH_PASSWORD}`);
      },
    };
    const failed = byId(
      await runOnlineChecks(ctx, { probe: reachable, core: failing }),
    );
    expect(failed['shared-cluster']!.status).toBe('error');
    expect(failed['shared-cluster']!.details).not.toContain('hunter2');
    const down = byId(
      await runOnlineChecks(ctx, {
        probe: async () => {
          throw new Error('ECONNREFUSED');
        },
        core: core([]),
      }),
    );
    expect(down['shared-cluster']!.status).toBe('skip');
  });

  it('БД недоступна → db-reachable = error без пароля, журнал = skip із причиною', async () => {
    const readJournal = vi.fn();
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: async () => {
          throw new Error(`connect ECONNREFUSED ${URL_WITH_PASSWORD}`);
        },
        core: { ...core([]), readJournal },
      }),
    );
    expect(checks['db-reachable']!.status).toBe('error');
    expect(checks['db-reachable']!.details).not.toContain('hunter2');
    expect(checks['migrations-journal']!.status).toBe('skip');
    expect(checks['migrations-journal']!.details).toContain('недоступна');
    expect(readJournal).not.toHaveBeenCalled();
  });

  it('помилка читання журналу → error без пароля', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: {
          ...core([]),
          readJournal: async () => {
            throw new Error(`permission denied ${URL_WITH_PASSWORD}`);
          },
        },
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).not.toContain('hunter2');
  });

  it('без DATABASE_URL обидва онлайн-рядки = skip, зонд не кликано', async () => {
    const probe = vi.fn();
    const checks = byId(
      await runOnlineChecks({ storeRoot: '/store', env: {} }, { probe }),
    );
    expect(checks['db-reachable']!.status).toBe('skip');
    expect(checks['migrations-journal']!.status).toBe('skip');
    expect(checks['shared-cluster']!.status).toBe('skip');
    expect(probe).not.toHaveBeenCalled();
  });

  it('readJournal отримує бюджет timeoutMs (3 с) — недоступна БД не підвішує doctor', async () => {
    const readJournal = vi.fn(async () => [] as unknown[]);
    await runOnlineChecks(ctx, {
      probe: reachable,
      core: { ...core([]), readJournal },
    });
    expect(readJournal).toHaveBeenCalledWith(URL_WITH_PASSWORD, {
      timeoutMs: CONNECT_TIMEOUT_MS,
    });
  });

  it('pg не встановлено в магазині → окремий зрозумілий skip, а не «Cannot find module»', async () => {
    const storeRoot = mkdtempSync(join(tmpdir(), 'doctor-nopg-'));
    try {
      writeFileSync(join(storeRoot, 'package.json'), '{}');
      const checks = byId(
        await runOnlineChecks({ storeRoot, env: ctx.env }, { core: core([]) }),
      );
      expect(checks['db-reachable']!.status).toBe('skip');
      expect(checks['db-reachable']!.details).toMatch(/pg не встановлено/);
      expect(checks['db-reachable']!.details).not.toMatch(/Cannot find module/);
      expect(checks['migrations-journal']!.status).toBe('skip');
    } finally {
      rmSync(storeRoot, { recursive: true });
    }
  });
});

// Через справжній `index.mjs`: підключення `--online` у `doctor.run` не видно
// з жодного юніта вище (там `runOnlineChecks` викликається напряму).
describe('cli doctor через index.mjs', () => {
  const cli = fileURLToPath(
    new URL('../packages/cli/src/index.mjs', import.meta.url),
  );
  const URL_WITH_PASSWORD = 'postgresql://app_runtime:hunter2@127.0.0.1:1/shop';

  function spawnDoctor(args: string[]) {
    const store = mkdtempSync(join(tmpdir(), 'doctor-spawn-'));
    try {
      writeFileSync(
        join(store, 'package.json'),
        JSON.stringify({ dependencies: { '@simplycms/core': '0.0.0' } }),
      );
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: URL_WITH_PASSWORD,
      };
      delete env.MIGRATION_DATABASE_URL;
      const run = spawnSync(process.execPath, [cli, 'doctor', ...args], {
        cwd: store,
        encoding: 'utf8',
        env,
      });
      return `${run.stdout}${run.stderr}`;
    } finally {
      rmSync(store, { recursive: true });
    }
  }

  it('--online → run іде в онлайн-гілку: рядки db-reachable/журнал, без db-online-skip', () => {
    const out = spawnDoctor(['--online']);
    expect(out).toContain('Доступність БД');
    expect(out).toContain('Журнал міграцій');
    expect(out).toContain('Окремий екземпляр Postgres');
    expect(out).not.toContain('вимкнені: doctor за замовчуванням оффлайн');
    expect(out).not.toContain('hunter2');
  });

  it('без --online → видимий skip із підказкою --online, онлайн-рядків немає', () => {
    const out = spawnDoctor([]);
    expect(out).toContain('--online');
    expect(out).not.toContain('Доступність БД');
  });
});
