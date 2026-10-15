import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rawExchange } from './server-smoke/raw-exchange.mjs';

/**
 * Р20′: база server functions для стелі тіла береться з іменованого експорту
 * `SERVER_FN_BASE` СПРАВЖНЬОЇ збірки, а не з `process.env`.
 *
 * Збираємо репозиторій з нестандартним `serverFns.base` (копія `vite.config.ts`
 * з однією вставкою, outDir у `node_modules/.cache`), бо лише справжній Start
 * доводить, що define інлайнить значення в `src/server.ts`. Стаб-бандл цього не
 * довів би: він би повторював припущення «Start кладе змінну в process.env».
 * Пакувальна сюїта: збірка ~хвилина, у дефолтний `pnpm test` не входить.
 */
const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, 'node_modules', '.cache', `fnbase-${process.pid}`);
const CONFIG = join(ROOT, `vite.fnbase-${process.pid}.config.ts`);
const MIB = 1024 * 1024;
const multipart =
  'POST %PATH% HTTP/1.1\r\nHost: shop.test\r\n' +
  'Content-Type: multipart/form-data; boundary=zz\r\nContent-Length: %LEN%\r\n\r\n';

const freePort = () =>
  new Promise<number>((done) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => done(port));
    });
  });

describe('база serverFn зі справжньої збірки (Р20′)', () => {
  let child: ReturnType<typeof spawn> | undefined;
  let port = 0;
  let log = '';

  beforeAll(async () => {
    const source = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    const patched = source
      .replace(
        "server: { entry: './server.ts' },",
        "server: { entry: './server.ts' },\n        serverFns: { base: '/_custom/fn' },",
      )
      .replace(
        'return {\n    plugins: [',
        `return {\n    build: { outDir: ${JSON.stringify(join(WORK, 'dist'))} },\n    plugins: [`,
      );
    expect(patched).not.toBe(source);
    writeFileSync(CONFIG, patched);
    const build = spawnSync(
      join(ROOT, 'node_modules/.bin/vite'),
      ['build', '--config', CONFIG],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: '' } },
    );
    if (build.status !== 0) throw new Error(build.stdout + build.stderr);

    for (const file of readdirSync(ROOT).filter((f) =>
      /^server(-[a-z-]+)?\.mjs$/.test(f),
    )) {
      copyFileSync(join(ROOT, file), join(WORK, file));
    }
    writeFileSync(join(WORK, 'package.json'), '{ "type": "module" }\n');
    port = await freePort();
    child = spawn(process.execPath, ['server.mjs'], {
      cwd: WORK,
      env: {
        PATH: process.env.PATH ?? '',
        PORT: String(port),
        HOST: '127.0.0.1',
        VITE_SITE_URL: 'https://shop.test',
        DATABASE_URL: 'postgres://x:x@127.0.0.1:1/x',
        BETTER_AUTH_SECRET: 'fnbase-test-secret-not-real-0123456789',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (c) => (log += c));
    child.stderr?.on('data', (c) => (log += c));
    const deadline = Date.now() + 20_000;
    while (!log.includes('слухає')) {
      if (child.exitCode !== null) throw new Error(`server.mjs упав:\n${log}`);
      if (Date.now() > deadline) throw new Error(`не піднявся:\n${log}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 240_000);

  afterAll(() => {
    child?.kill('SIGKILL');
    rmSync(WORK, { recursive: true, force: true });
    rmSync(CONFIG, { force: true });
  });

  it('у зібраному server.js база — літерал, а не читання process.env', () => {
    const server = readFileSync(join(WORK, 'dist/server/server.js'), 'utf8');
    expect(server).toMatch(/SERVER_FN_BASE\s*=\s*"\/_custom\/fn\/"/);
    expect(server).not.toMatch(/=\s*process\.env\.TSS_SERVER_FN_BASE/);
  });

  it('multipart 20 МіБ на нестандартній базі проходить стелю, на /_serverFn/ — 413', async () => {
    const head = (path: string) =>
      multipart.replace('%PATH%', path).replace('%LEN%', String(20 * MIB));
    const custom = await rawExchange(
      port,
      head('/_custom/fn/x'),
      Buffer.alloc(20 * MIB, 0x61),
      1500,
    );
    expect(custom.status).not.toBe(413);
    const dflt = await rawExchange(
      port,
      head('/_serverFn/x'),
      Buffer.alloc(1024, 0x61),
    );
    expect(dflt.status).toBe(413);
  }, 60_000);
});
