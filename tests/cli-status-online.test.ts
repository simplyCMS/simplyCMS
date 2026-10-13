import { afterAll, describe, expect, it } from 'vitest';
import { runOnlineChecks } from '../packages/cli/src/doctor-db-checks.mjs';
import { collectStatus } from '../packages/cli/src/status.mjs';
import {
  healthCheck,
  onlineTasks,
} from '../packages/cli/src/status-online.mjs';
import { statusExitCode } from '../packages/cli/src/status-stage.mjs';
import { scaffoldFakeStore } from './lib/fake-core-store';

// Онлайн-частина `status` й наповнення магазину в `doctor --online` (К3-Е8, Task 21).
// Ядро й мережа — фейкові; живу БД доводить `test:schema` (migrate-store-facts).
const URL_WITH_PASSWORD = 'postgresql://app_runtime:hunter2@db:5432/shop';
const ctx = { storeRoot: '/store', env: { DATABASE_URL: URL_WITH_PASSWORD } };
const GOOD = {
  owners: 1,
  profile: { name: 'Shop', email: 'shop@example.com' },
  failedMail: 0,
};
type Row = { id: string; status: string; details?: string };
const byId = (checks: Row[]) =>
  Object.fromEntries(checks.map((c) => [c.id, c])) as Record<string, Row>;

const core = (facts: unknown | Error) => ({
  listMigrationFiles: () => [],
  readJournal: async () => [],
  pendingMigrations: () => ({ pending: [], changed: [] }),
  findForeignDatabases: async () => [],
  readStoreFacts: async () => {
    if (facts instanceof Error) throw facts;
    return facts;
  },
});
const facts = async (value: unknown | Error) =>
  byId(
    await runOnlineChecks(ctx, { probe: async () => {}, core: core(value) }),
  );

describe('наповнення магазину (спільне для status і doctor --online)', () => {
  it('усе гаразд → три ok', async () => {
    const c = await facts(GOOD);
    expect(c['store-owner']!.status).toBe('ok');
    expect(c['store-profile']!.status).toBe('ok');
    expect(c['mail-outbox']!.status).toBe('ok');
  });

  it('власника немає → warn з командою створення', async () => {
    const c = await facts({ ...GOOD, owners: 0 });
    expect(c['store-owner']!.status).toBe('warn');
    expect(c['store-owner']!.details).toContain('owner:invite');
  });

  it('порожній email профілю → warn «листи власнику … не надходитимуть»', async () => {
    const c = await facts({
      ...GOOD,
      profile: { name: 'Shop', email: null },
    });
    expect(c['store-profile']!.status).toBe('warn');
    expect(c['store-profile']!.details).toContain(
      'листи власнику про замовлення не надходитимуть',
    );
  });

  it('профілю нема чи назва порожня → warn про назву', async () => {
    for (const profile of [null, { name: '', email: 'a@b.c' }]) {
      const c = await facts({ ...GOOD, profile });
      expect(c['store-profile']!.status).toBe('warn');
      expect(c['store-profile']!.details).toContain('назву');
    }
  });

  it('невдалі листи → warn із кількістю', async () => {
    const c = await facts({ ...GOOD, failedMail: 3 });
    expect(c['mail-outbox']!.status).toBe('warn');
    expect(c['mail-outbox']!.details).toContain('3');
  });

  it('читання фактів упало → error store-state без пароля', async () => {
    const c = await facts(new Error(`permission denied ${URL_WITH_PASSWORD}`));
    expect(c['store-state']!.status).toBe('error');
    expect(c['store-state']!.details).not.toContain('hunter2');
    expect(c['migrations-journal']!.status).toBe('ok');
  });

  it('БД недоступна → store-state = skip', async () => {
    const c = byId(
      await runOnlineChecks(ctx, {
        probe: async () => {
          throw new Error('ECONNREFUSED');
        },
        core: core(GOOD),
      }),
    );
    expect(c['store-state']!.status).toBe('skip');
  });
});

describe('healthCheck домену', () => {
  const respond = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status });

  it('healthy + build → ok зі збіркою; запит іде на https://<domain>/api/health', async () => {
    let seen = '';
    const check = await healthCheck('shop.example.com', async (url) => {
      seen = String(url);
      return respond(200, { status: 'healthy', build: 'abc123' })();
    });
    expect(seen).toBe('https://shop.example.com/api/health');
    expect(check).toMatchObject({ id: 'domain-health', status: 'ok' });
    expect(check.details).toContain('abc123');
  });

  it('degraded 503 → error', async () => {
    const check = await healthCheck(
      'shop.example.com',
      respond(503, { status: 'degraded' }),
    );
    expect(check.status).toBe('error');
    expect(check.details).toContain('503');
  });

  it('мережева помилка → error; таймаут → error із бюджетом', async () => {
    const down = await healthCheck('shop.example.com', async () => {
      throw new Error('getaddrinfo ENOTFOUND shop.example.com');
    });
    expect(down.status).toBe('error');
    const slow = await healthCheck('shop.example.com', async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    });
    expect(slow.details).toContain('3000');
  });
});

describe('onlineTasks і collectStatus', () => {
  const record = { domain: 'shop.example.com' };

  it('домен перевіряється лише в етапі deployed (є запис)', () => {
    const labels = (deployRecord: unknown) =>
      onlineTasks({ storeRoot: '/s', env: {}, deployRecord } as never).map(
        (t: { label: string }) => t.label,
      );
    expect(labels(null)).toEqual(['стан БД']);
    expect(labels(record)).toEqual(['стан БД', 'домен (/api/health)']);
  });

  const roots: string[] = [];
  const store = (name: string) => scaffoldFakeStore(name, roots);
  afterAll(async () => {
    const { rmSync } = await import('node:fs');
    for (const dir of roots) rmSync(dir, { recursive: true, force: true });
  });

  it('онлайн-завдання, що не вклалось у бюджет, → unknown, решта працює, код 1', async () => {
    const root = await store('so-slow');
    const started = Date.now();
    const report = await collectStatus(root, {
      checks: [],
      timeoutMs: 300,
      online: () => [
        {
          label: 'стан БД',
          run: (() =>
            new Promise((resolve) =>
              (
                setTimeout(resolve, 10_000) as unknown as { unref(): void }
              ).unref(),
            )) as never,
        },
        {
          label: 'домен',
          run: () => ({ id: 'domain-health', title: 'Д', status: 'ok' }),
        },
      ],
    });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toContain('стан БД');
    expect(report.checks.map((c: Row) => c.id)).toEqual(['domain-health']);
    expect(statusExitCode(report)).toBe(1);
  }, 15_000);

  it('error онлайн-перевірки веде до simplycms-diagnose, код 3', async () => {
    const root = await store('so-error');
    const report = await collectStatus(root, {
      checks: [],
      online: () => [
        {
          label: 'стан БД',
          run: () => [
            { id: 'db-reachable', title: 'БД', status: 'error' },
            { id: 'store-owner', title: 'В', status: 'warn' },
          ],
        },
      ],
    });
    expect(report.checks).toHaveLength(2);
    expect(report.next?.skill).toBe('simplycms-diagnose');
    expect(statusExitCode(report)).toBe(3);
  });
});
