import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// Шим `scripts/start.mjs` на справжньому execve: корінь магазину — від
// розташування скрипта, а не від cwd (`node /app/scripts/start.mjs` з іншої теки).
// Логіка — СПРАВЖНІ сирці `simplycms/prod-start` (копія теки в node_modules
// тимчасового магазину, TS через tsx); заглушки — лише `simplycms/env` і
// `simplycms/migrate`, бо БД тут немає (справжній накат — start-migrate.test.ts).
const TEMPLATE = join(
  __dirname,
  '..',
  'packages/create-simplycms-store/template',
);
const PROD_START = join(__dirname, '..', 'packages/simplycms/src/prod-start');
const TSX = pathToFileURL(createRequire(__filename).resolve('tsx')).href;
const dirs: string[] = [];

afterAll(() =>
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe('scripts/start.mjs (шим)', () => {
  it('запуск з чужої cwd: server.mjs стартує в корені магазину, пароль власника зрізано', () => {
    const store = mkdtempSync(join(tmpdir(), 'start-script-'));
    dirs.push(store);
    mkdirSync(join(store, 'scripts'));
    copyFileSync(
      join(TEMPLATE, 'scripts/start.mjs'),
      join(store, 'scripts/start.mjs'),
    );
    writeFileSync(join(store, 'package.json'), '{ "type": "module" }\n');
    writeFileSync(
      join(store, 'server.mjs'),
      'console.log(JSON.stringify({ cwd: process.cwd(), owner: process.env.MIGRATION_DATABASE_URL ?? null }));\n',
    );
    const pkg = join(store, 'node_modules', 'simplycms');
    cpSync(PROD_START, join(pkg, 'prod-start'), {
      recursive: true,
      filter: (src) => !src.includes('__tests__'),
    });
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({
        name: 'simplycms',
        type: 'module',
        exports: {
          './prod-start': './prod-start/index.ts',
          './env': './env.mjs',
          './migrate': './migrate.mjs',
        },
      }),
    );
    writeFileSync(
      join(pkg, 'env.mjs'),
      'export const resolveDriverEnv = () => ({ warnings: [] });\n',
    );
    writeFileSync(
      join(pkg, 'migrate.mjs'),
      'export const applyMigrations = async () => ({ applied: [] });\n',
    );

    const elsewhere = mkdtempSync(join(tmpdir(), 'start-elsewhere-'));
    dirs.push(elsewhere);
    const run = spawnSync(
      process.execPath,
      ['--import', TSX, join(store, 'scripts/start.mjs')],
      {
        cwd: elsewhere,
        env: {
          PATH: process.env.PATH ?? '',
          MIGRATION_DATABASE_URL: 'postgres://o:p@x/db',
        },
        encoding: 'utf8',
      },
    );

    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toContain('нічого накочувати');
    const line = JSON.parse(run.stdout.trim().split('\n').pop()!);
    expect(line.owner).toBeNull();
    expect(line.cwd.endsWith(store.split('/').pop()!)).toBe(true);
  });
});
