#!/usr/bin/env node
/**
 * Гейт релізу `pilot` — повний `pnpm pilot` проти живої БД харнеса.
 *
 * 🔴 Чому не режим без БД (пакувальний): без БД Gate B (production-запуск `server.mjs` скретча) не існує,
 * а саме він ловить «бандл не стартує» (`UPSTREAM:START-IP-1`, Task 11 К3-Е7). Тому реліз сам
 * піднімає харнес (`pnpm harness:up`, ідемпотентно), накочує канон + демо-сід на СВІЖУ БД
 * (`db:demo` дропає й створює її наново) і ганяє `pnpm pilot` з цим DSN. Gate B не скорочується.
 *
 * Харнес після прогону не гаситься: `harness:up` ідемпотентний, а контейнер
 * (`simplycms-harness-pg`) потрібен і `test:schema`; прибрати — `pnpm harness:down`.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
const DB_NAME = 'release_pilot';
const run = (cmd, env = {}) =>
  execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });

try {
  run('pnpm harness:up');
} catch {
  throw new Error(
    'Не вдалося підняти харнес БД (`pnpm harness:up`): Docker потрібен гейту `pilot` релізу.',
  );
}
// harness:up пише `.env.harness` з PG_HARNESS_URL — беремо звідти адмін-DSN кластера.
const harnessUrl = /^PG_HARNESS_URL=(.+)$/m.exec(
  readFileSync(join(ROOT, '.env.harness'), 'utf8'),
)?.[1];
if (!harnessUrl) throw new Error('У .env.harness немає PG_HARNESS_URL');

run(`pnpm db:demo --name ${DB_NAME}`);
const databaseUrl = new URL(harnessUrl);
databaseUrl.pathname = `/${DB_NAME}`;
run(`node scripts/pilot-pack/apply-probe.mjs ${databaseUrl.toString()}`);
run('pnpm pilot', {
  PILOT_DATABASE_URL: databaseUrl.toString(),
  PILOT_BETTER_AUTH_SECRET: randomBytes(24).toString('hex'),
});
