import { describe, expect, it, vi } from 'vitest';
import {
  describeError,
  EXIT_PENDING,
  parseDbApplyArgs,
  run,
} from '../packages/cli/src/db-apply.mjs';
import { redactUrls } from '../packages/cli/src/redact-urls.mjs';
import { importFromStore } from '../packages/cli/src/store-core.mjs';

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
    expect(out).toContain('postgres://owner:***@h:5432/db');
  });

  it('невідомий аргумент — помилка розбору', () => {
    expect(parseDbApplyArgs(['--check', '--dry-run'])).toEqual({
      check: true,
      dryRun: true,
    });
    expect(() => parseDbApplyArgs(['--wat'])).toThrow(/--wat/);
  });

  it('describeError: не-Error значення теж маскується', () => {
    expect(describeError(`bad ${OWNER}`)).not.toContain('s3cr3t');
  });
});

describe('redactUrls', () => {
  it('маскує пароль, лишаючи схему, користувача й хост', () => {
    expect(redactUrls('x postgres://u:p@h:1/d y')).toBe(
      'x postgres://u:***@h:1/d y',
    );
    expect(redactUrls('postgresql://u:p%40ss@h/d?sslmode=require')).toBe(
      'postgresql://u:***@h/d?sslmode=require',
    );
  });

  it('невкодований @ у паролі не лишає хвоста; URL без пароля не чіпається', () => {
    expect(redactUrls('postgres://u:pa@ss@h/d')).toBe('postgres://u:***@h/d');
    expect(redactUrls('postgres://u@h/d')).toBe('postgres://u@h/d');
    expect(redactUrls('без урлів')).toBe('без урлів');
  });

  it('кілька URL в одному тексті', () => {
    const out = redactUrls('a postgres://u:1@h/d b postgres://v:2@g/e');
    expect(out).not.toMatch(/:1@|:2@/);
  });
});

describe('importFromStore', () => {
  it('субшлях лише з умовою import (як опублікований simplycms/migrate) резолвиться', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'store-core-'));
    const pkg = join(root, 'node_modules', 'fake-core');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({
        name: 'fake-core',
        type: 'module',
        exports: {
          './migrate': {
            types: './dist/index.d.ts',
            import: './dist/index.js',
          },
        },
      }),
    );
    writeFileSync(join(pkg, 'dist/index.js'), 'export const marker = 42;\n');
    const mod = await importFromStore(root, 'fake-core/migrate');
    expect(mod.marker).toBe(42);
  });
});
