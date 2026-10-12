import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// start.mjs на справжньому execve: корінь магазину — від розташування скрипта,
// а не від cwd (`node /app/scripts/start.mjs` з іншої теки). Ядро (simplycms/env,
// simplycms/migrate) підмінено заглушками в node_modules тимчасового магазину.
const TEMPLATE = join(
  __dirname,
  '..',
  'packages/create-simplycms-store/template',
);
const dirs: string[] = [];

afterAll(() =>
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe('scripts/start.mjs', () => {
  it('запуск з чужої cwd: server.mjs стартує в корені магазину, пароль власника зрізано', () => {
    const store = mkdtempSync(join(tmpdir(), 'start-script-'));
    dirs.push(store);
    mkdirSync(join(store, 'scripts'));
    for (const f of ['start.mjs', 'start-core.mjs'])
      copyFileSync(join(TEMPLATE, 'scripts', f), join(store, 'scripts', f));
    writeFileSync(join(store, 'package.json'), '{ "type": "module" }\n');
    writeFileSync(
      join(store, 'server.mjs'),
      'console.log(JSON.stringify({ cwd: process.cwd(), owner: process.env.MIGRATION_DATABASE_URL ?? null }));\n',
    );
    const pkg = join(store, 'node_modules', 'simplycms');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'package.json'),
      '{ "name": "simplycms", "type": "module", "exports": { "./env": "./env.mjs", "./migrate": "./migrate.mjs" } }\n',
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
      [join(store, 'scripts/start.mjs')],
      {
        cwd: elsewhere,
        env: {
          PATH: process.env.PATH ?? '',
          MIGRATION_DATABASE_URL: 'postgres://o:p@x/db',
        },
        encoding: 'utf8',
      },
    );

    expect(run.status).toBe(0);
    const line = JSON.parse(run.stdout.trim().split('\n').pop()!);
    expect(line.owner).toBeNull();
    expect(line.cwd.endsWith(store.split('/').pop()!)).toBe(true);
  });
});
