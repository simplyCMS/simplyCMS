import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  describeError,
  EXIT_PENDING,
  parseDbApplyArgs,
  run,
} from '../packages/cli/src/db-apply.mjs';

// `simplycms db:apply` без живої БД: ядро (`simplycms/migrate`) підміняється
// фейком через ін'єкцію в `run`. Живу поведінку накату доводять тести ядра
// (`test:schema`) і живий прогін на харнесі.

const OWNER = 'postgres://owner:s3cr3t@h:5432/db';
const RUNTIME = 'postgres://app_runtime:rt-pass@h:5432/db';

type Report = { applied: string[]; pending: string[] };

function harness(env: Record<string, string>) {
  const applyMigrations = vi.fn(
    async (_options: Record<string, unknown>): Promise<Report> => ({
      applied: [],
      pending: [],
    }),
  );
  const lines: string[] = [];
  const push = (line: string) => lines.push(line);
  const ui = {
    begin: push,
    finish: push,
    info: push,
    success: push,
    warn: push,
    error: push,
    step: push,
  };
  const call = (argv: string[]) =>
    run(argv, {
      storeRoot: '/store',
      env,
      core: { applyMigrations },
      ui,
    });
  return { applyMigrations, call, text: () => lines.join('\n') };
}

describe('simplycms db:apply', () => {
  it('без MIGRATION_DATABASE_URL, але з DATABASE_URL → 1, називає змінну, ядро не кликано', async () => {
    const h = harness({ DATABASE_URL: RUNTIME });
    expect(await h.call([])).toBe(1);
    expect(h.text()).toContain('MIGRATION_DATABASE_URL');
    expect(h.text()).not.toContain('rt-pass');
    expect(h.applyMigrations).not.toHaveBeenCalled();
  });

  it('накат: connectionString — власник, runtimeUrl — DATABASE_URL, dir — db/migrations магазину', async () => {
    const h = harness({
      MIGRATION_DATABASE_URL: OWNER,
      DATABASE_URL: RUNTIME,
    });
    h.applyMigrations.mockResolvedValue({
      applied: ['0005_x.sql'],
      pending: [],
    });
    expect(await h.call([])).toBe(0);
    expect(h.applyMigrations).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: OWNER,
        runtimeUrl: RUNTIME,
        dryRun: false,
      }),
    );
    const dir = String(h.applyMigrations.mock.calls[0]![0].dir);
    expect(dir.replaceAll('\\', '/')).toBe('/store/db/migrations');
    expect(h.text()).toContain('0005_x.sql');
  });

  it('--check з pending → 3 з іменем файлу; без pending → 0', async () => {
    const h = harness({ MIGRATION_DATABASE_URL: OWNER });
    h.applyMigrations.mockResolvedValue({
      applied: [],
      pending: ['0005_x.sql'],
    });
    expect(await h.call(['--check'])).toBe(EXIT_PENDING);
    expect(h.text()).toContain('0005_x.sql');
    expect(h.applyMigrations).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );

    h.applyMigrations.mockResolvedValue({ applied: [], pending: [] });
    expect(await h.call(['--check'])).toBe(0);
  });

  it('--dry-run → ядро отримує dryRun:true, код 0 навіть із pending', async () => {
    const h = harness({ MIGRATION_DATABASE_URL: OWNER });
    h.applyMigrations.mockResolvedValue({
      applied: [],
      pending: ['0005_x.sql'],
    });
    expect(await h.call(['--dry-run'])).toBe(0);
    expect(h.applyMigrations).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('помилка ядра: ім’я, код і повідомлення, але без пароля з URL', async () => {
    const h = harness({ MIGRATION_DATABASE_URL: OWNER });
    h.applyMigrations.mockRejectedValue(
      Object.assign(new Error(`connect failed for ${OWNER}`), {
        name: 'Error',
        code: 'ECONNREFUSED',
      }),
    );
    expect(await h.call([])).toBe(1);
    const out = h.text();
    expect(out).not.toContain('s3cr3t');
    expect(out).toContain('ECONNREFUSED');
    expect(out).not.toContain('Error ECONNREFUSED');
    expect(out).toContain('postgres://owner:***@h:5432/db');
  });

  it('невідомий аргумент — помилка розбору', () => {
    expect(parseDbApplyArgs(['--check', '--dry-run'])).toEqual({
      check: true,
      dryRun: true,
    });
    expect(() => parseDbApplyArgs(['--wat'])).toThrow(/--wat/);
  });

  it('describeError: базове «Error» не друкується, спеціалізоване ім’я — так', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    const typed = Object.assign(new Error('x'), {
      name: 'MigrationChecksumError',
    });
    expect(describeError(typed)).toBe('MigrationChecksumError: x');
  });

  it('describeError: не-Error значення теж маскується', () => {
    expect(describeError(`bad ${OWNER}`)).not.toContain('s3cr3t');
  });
});

// 🔴 Код виходу доходить до процесу лише через `index.mjs` (`process.exitCode`):
// юніти вище бачать значення, що повертає `run`, і не помітили б, що рядок з
// прокиданням зник — тоді `db:apply --check` у CI перестав би червоніти.
describe('simplycms db:apply через index.mjs', () => {
  const cli = fileURLToPath(
    new URL('../packages/cli/src/index.mjs', import.meta.url),
  );

  it('без MIGRATION_DATABASE_URL → процес виходить з 1 і називає змінну', () => {
    const store = mkdtempSync(join(tmpdir(), 'db-apply-spawn-'));
    try {
      writeFileSync(
        join(store, 'package.json'),
        JSON.stringify({ dependencies: { '@simplycms/core': '0.0.0' } }),
      );
      const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: RUNTIME };
      delete env.MIGRATION_DATABASE_URL;
      const run = spawnSync(process.execPath, [cli, 'db:apply'], {
        cwd: store,
        encoding: 'utf8',
        env,
      });
      expect(run.status).toBe(1);
      const out = `${run.stdout}${run.stderr}`;
      expect(out).toContain('MIGRATION_DATABASE_URL');
      expect(out).not.toContain('rt-pass');
    } finally {
      rmSync(store, { recursive: true });
    }
  });
});
