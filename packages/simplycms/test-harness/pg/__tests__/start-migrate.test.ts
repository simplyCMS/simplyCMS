// Прод-старт на справжньому накаті (К3-Е8, Е8-Р6): `runStart` зі справжнім
// `applyMigrations` і фейковим `execve` на чистій БД → журнал повний, а
// `execve` отримує оточення без пароля власника схеми. Юніт порядку кроків
// на фейках — `prod-start/__tests__/run-start.test.ts`; реальний `execve` — Gate B пілота.
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveDriverEnv } from 'simplycms/env';
import { applyMigrations } from 'simplycms/migrate';
import { runStart } from 'simplycms/prod-start';
import { resolveHarness } from '../up.mjs';
import { canonNames, freshDb, journalOf } from './fixtures/migrate';

const STORE_DIR = join(
  import.meta.dirname,
  '../../../../create-simplycms-store/template',
);

describe('runStart: накат і execve на справжній БД', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('чиста БД → журнал повний, execve без MIGRATION_DATABASE_URL', async () => {
    const db = await freshDb(harness.url);
    try {
      const execve = vi.fn((file: string, args: string[], env: unknown) => {
        void [file, args, env];
      });
      const logs: string[] = [];
      const runtimeUrl = 'postgres://app_runtime:rt-pass@localhost:5432/shop';
      await runStart({
        env: {
          DATABASE_URL: runtimeUrl,
          MIGRATION_DATABASE_URL: db.url,
          PATH: '/usr/bin',
        },
        cwd: STORE_DIR,
        migrate: applyMigrations,
        resolveDriverEnv,
        execve,
        log: (message: string) => logs.push(message),
      });

      expect((await journalOf(db.url)).map((row) => row.name)).toEqual(
        canonNames(),
      );
      expect(execve).toHaveBeenCalledOnce();
      const env = execve.mock.calls[0]![2] as Record<string, string>;
      expect(env).toEqual({ DATABASE_URL: runtimeUrl, PATH: '/usr/bin' });
      expect(logs.join('\n')).not.toContain(db.url);
    } finally {
      await db.drop();
    }
  }, 120_000);
});
