#!/usr/bin/env node
/**
 * `pnpm harness:up` / `pnpm harness:down` — Postgres-харнес для `test:schema`,
 * `live:smoke`, `db:demo` одним командою.
 *
 * Чому скрипт, а не ручний `docker run`: порт, імʼя контейнера й рядок
 * підключення раніше кожен вигадував сам, і сесії розходились. Тепер це одне
 * місце: контейнер `simplycms-harness-pg` (pgvector/pgvector:pg17, trust) на
 * фіксованому порту, а `PG_HARNESS_URL` пишеться в git-ignored `.env.harness`,
 * який споживачі (`vitest.schema.config.ts`, `live-smoke.mjs`, `demo-db.mjs`)
 * підхоплюють через `process.loadEnvFile`, якщо змінну не задано явно.
 * Ідемпотентний: уже запущений контейнер не чіпається.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NAME = 'simplycms-harness-pg';
const PORT = 54331;
const IMAGE = 'pgvector/pgvector:pg17';
const URL_ = `postgres://postgres@localhost:${PORT}/postgres`;
const ENV_FILE = join(import.meta.dirname, '..', '.env.harness');

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
const fail = (msg) => {
  console.error(`[harness] ${msg}`);
  process.exit(1);
};

const probe = docker('info', '--format', '{{.ServerVersion}}');
if (probe.error || probe.status !== 0)
  fail(
    'Docker недоступний (немає бінарника або демон не запущений). ' +
      'Запусти Docker або задай PG_HARNESS_URL на готовий кластер вручну.',
  );

if (process.argv[2] === 'down') {
  docker('rm', '-f', NAME);
  console.log(
    `[harness] ${NAME} зупинено (.env.harness лишено — він ідемпотентний).`,
  );
  process.exit(0);
}

const running = docker(
  'ps',
  '--filter',
  `name=^${NAME}$`,
  '--format',
  '{{.Names}}',
).stdout.trim();
if (!running) {
  // Зупинений контейнер без --rm прибираємо, щоб не впертись в зайняте імʼя.
  docker('rm', '-f', NAME);
  const run = docker(
    'run',
    '-d',
    '--rm',
    '--name',
    NAME,
    '-p',
    `${PORT}:5432`,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    IMAGE,
  );
  if (run.status !== 0) fail(`docker run не вдався: ${run.stderr.trim()}`);
}

// pg_isready у ініціалізації образу відповідає двічі (тимчасовий сервер,
// потім справжній), тому вимагаємо кілька успіхів поспіль.
const deadline = Date.now() + 60_000;
let ok = 0;
while (ok < 3) {
  if (Date.now() > deadline) fail('Postgres не став готовим за 60 с.');
  const r = docker(
    'exec',
    NAME,
    'pg_isready',
    '-U',
    'postgres',
    '-h',
    '127.0.0.1',
  );
  ok = r.status === 0 ? ok + 1 : 0;
  if (ok < 3) await new Promise((res) => setTimeout(res, 500));
}

writeFileSync(ENV_FILE, `PG_HARNESS_URL=${URL_}\n`);
console.log(`PG_HARNESS_URL=${URL_}`);
