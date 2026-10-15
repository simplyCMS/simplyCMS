#!/usr/bin/env node
/**
 * Гейт релізу `pilot` — повний `pnpm pilot` проти живої БД харнеса.
 *
 * 🔴 Чому не режим без БД (пакувальний): без БД Gate B (production-запуск `server.mjs` скретча) не існує,
 * а саме він ловить «бандл не стартує» (`UPSTREAM:START-IP-1`, Task 11 К3-Е7). Тому реліз сам
 * піднімає харнес (`pnpm harness:up`, ідемпотентно: Postgres, Garage, Mailpit), накочує канон + демо-сід на СВІЖУ БД
 * (`db:demo` дропає й створює її наново) і ганяє `pnpm pilot` з цим DSN. Gate B не скорочується.
 *
 * Харнес після прогону не гаситься: `harness:up` ідемпотентний, а контейнер
 * (`simplycms-harness-pg`) потрібен і `test:schema`; прибрати — `pnpm harness:down`.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
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
const harness = parseEnv(readFileSync(join(ROOT, '.env.harness'), 'utf8'));
const harnessUrl = harness.PG_HARNESS_URL;
if (!harnessUrl) throw new Error('У .env.harness немає PG_HARNESS_URL');
// Garage і Mailpit харнесу (К3-Е8): повна група обов'язкова, неповна — помилка тут,
// а не тихе «без сховища й пошти» у релізному гейті. Імена `PILOT_*` — див. `env.mjs`.
const S3 = ['ENDPOINT', 'REGION', 'BUCKET', 'ACCESS_KEY', 'SECRET_KEY'];
const needed = [
  ...S3.map((k) => `S3_${k}`),
  'HARNESS_SMTP_URL',
  'HARNESS_MAILPIT_URL',
];
const missing = needed.filter((k) => !harness[k]);
if (missing.length > 0)
  throw new Error(`У .env.harness немає ключів: ${missing.join(', ')}`);

run(`pnpm db:demo --name ${DB_NAME}`);
const databaseUrl = new URL(harnessUrl);
databaseUrl.pathname = `/${DB_NAME}`;
run(`node scripts/pilot-pack/apply-probe.mjs ${databaseUrl.toString()}`);
run('pnpm pilot', {
  PILOT_DATABASE_URL: databaseUrl.toString(),
  PILOT_BETTER_AUTH_SECRET: randomBytes(24).toString('hex'),
  ...Object.fromEntries(S3.map((k) => [`PILOT_S3_${k}`, harness[`S3_${k}`]])),
  PILOT_SMTP_URL: harness.HARNESS_SMTP_URL,
  PILOT_MAIL_FROM: 'pilot@simplycms.test',
  PILOT_MAILPIT_URL: harness.HARNESS_MAILPIT_URL,
});
