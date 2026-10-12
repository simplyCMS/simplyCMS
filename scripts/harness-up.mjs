#!/usr/bin/env node
/**
 * `pnpm harness:up` / `pnpm harness:down` — стенд для `test:schema`, `live:smoke`,
 * `db:demo` і контракту драйверів одною командою: Postgres, Garage (S3) і Mailpit (SMTP).
 *
 * Чому скрипт, а не ручний `docker run`: порт, імʼя контейнера й рядок
 * підключення раніше кожен вигадував сам, і сесії розходились. Тепер це одне
 * місце: три контейнери на фіксованих портах, а їхні адреси пишуться в git-ignored
 * `.env.harness`, який споживачі (`vitest.schema.config.ts`, `live-smoke.mjs`,
 * `demo-db.mjs`) підхоплюють через `harness-env.mjs`, якщо змінну не задано явно
 * і контейнер живий. Ідемпотентний: уже запущений контейнер не чіпається.
 *
 * Змінні `HARNESS_PREFIX`, `HARNESS_*_PORT`, `HARNESS_ENV_FILE` існують для тесту
 * самого скрипта (повний цикл up/down на окремих іменах, не чіпаючи спільний стенд)
 * та для машини, де дефолтний порт зайнятий чужим сервісом; дефолти — фіксовані.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePort } from './harness-ports.mjs';

const ROOT = join(import.meta.dirname, '..');
const PREFIX = process.env.HARNESS_PREFIX ?? 'simplycms-harness';
const num = (key, fallback, opts) => {
  try {
    return parsePort(key, process.env[key], fallback, opts);
  } catch (error) {
    console.error(`[harness] ${error.message}`);
    process.exit(1);
  }
};

const PG = {
  name: `${PREFIX}-pg`,
  port: num('HARNESS_PG_PORT', 54331),
  image: 'pgvector/pgvector:pg17',
};
// 🔴 Порт Garage — НЕ 4190: це в списку заборонених портів WHATWG fetch, і
// `fetch` відмовляє ще до мережі (UPSTREAM:FETCH-BAD-PORT-1).
const GARAGE = {
  name: `${PREFIX}-garage`,
  port: num('HARNESS_GARAGE_PORT', 4192, { fetchable: true }),
  image: 'dxflrs/garage:v2.4.1',
  region: 'garage',
  bucket: 'simplycms-harness',
  // Формат ключів Garage: `GK` + 24 hex і 64 hex; значення — детерміновані заглушки стенду.
  accessKey: 'GK73696d706c79636d73303030',
  secretKey: 'e'.repeat(64),
  rpcSecret: '0'.repeat(64),
};
const MAILPIT = {
  name: `${PREFIX}-mailpit`,
  smtpPort: num('HARNESS_SMTP_PORT', 54325),
  httpPort: num('HARNESS_MAILPIT_PORT', 54326),
  // Точний тег, не `latest`: стенд відтворюваний, а бамп — свідомий.
  image: 'axllent/mailpit:v1.31.3',
};
const ENV_FILE = process.env.HARNESS_ENV_FILE ?? join(ROOT, '.env.harness');
const NAMES = [PG.name, GARAGE.name, MAILPIT.name];

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
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
  for (const name of NAMES) docker('rm', '-f', name);
  // Застарілий файл змусив би споживачів ганятись за мертвим URL.
  rmSync(ENV_FILE, { force: true });
  console.log(`[harness] ${NAMES.join(', ')} зупинено, .env.harness видалено.`);
  process.exit(0);
}

/** Запускає контейнер, якщо його ще немає; зупинений прибирає, щоб не впертись в імʼя. */
function ensure(name, runArgs, published) {
  const running = docker(
    'ps',
    '--filter',
    `name=^${name}$`,
    '--format',
    '{{.Names}}',
  ).stdout.trim();
  if (running) {
    // Уже запущений контейнер на іншому порту, ніж просять, дав би у
    // `.env.harness` адресу, за якою нічого немає.
    if (published) {
      const actual = docker('port', name, `${published.inner}/tcp`)
        .stdout.split('\n')[0]
        ?.split(':')
        .pop();
      if (actual && Number(actual) !== published.port)
        fail(
          `${name} уже запущено на порту ${actual}, а просять ${published.port}. ` +
            `Або викинь HARNESS_*_PORT, або перестворіть стенд (pnpm harness:down).`,
        );
    }
    return;
  }
  docker('rm', '-f', name);
  const run = docker('run', '-d', '--rm', '--name', name, ...runArgs);
  if (run.status !== 0)
    fail(`docker run ${name} не вдався: ${run.stderr.trim()}`);
}

async function waitReady(what, check, needed = 1) {
  const deadline = Date.now() + 60_000;
  let ok = 0;
  while (ok < needed) {
    if (Date.now() > deadline) fail(`${what} не став готовим за 60 с.`);
    ok = (await check()) ? ok + 1 : 0;
    if (ok < needed) await sleep(500);
  }
}

ensure(PG.name, [
  '-p',
  `${PG.port}:5432`,
  '-e',
  'POSTGRES_HOST_AUTH_METHOD=trust',
  PG.image,
]);
ensure(
  GARAGE.name,
  [
    '-p',
    `${GARAGE.port}:3900`,
    '-v',
    `${join(ROOT, 'docker/garage/garage.dev.toml')}:/etc/garage.toml:ro`,
    '-e',
    `GARAGE_RPC_SECRET=${GARAGE.rpcSecret}`,
    '-e',
    `GARAGE_DEFAULT_ACCESS_KEY=${GARAGE.accessKey}`,
    '-e',
    `GARAGE_DEFAULT_SECRET_KEY=${GARAGE.secretKey}`,
    '-e',
    `GARAGE_DEFAULT_BUCKET=${GARAGE.bucket}`,
    GARAGE.image,
    '/garage',
    'server',
    '--single-node',
    '--default-bucket',
  ],
  { inner: 3900, port: GARAGE.port },
);
ensure(MAILPIT.name, [
  '-p',
  `${MAILPIT.smtpPort}:1025`,
  '-p',
  `${MAILPIT.httpPort}:8025`,
  MAILPIT.image,
]);

// pg_isready у ініціалізації образу відповідає двічі (тимчасовий сервер,
// потім справжній), тому вимагаємо кілька успіхів поспіль.
await waitReady(
  'Postgres',
  () =>
    docker('exec', PG.name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1')
      .status === 0,
  3,
);
// Образ Garage — scratch (без shell), HEALTHCHECK неможливий: готовність за логом.
await waitReady('Garage', () => {
  const logs = docker('logs', GARAGE.name);
  return `${logs.stdout}${logs.stderr}`.includes('S3 API server listening');
});
await waitReady('Mailpit', async () => {
  try {
    return (await fetch(`http://localhost:${MAILPIT.httpPort}/api/v1/info`)).ok;
  } catch {
    return false;
  }
});

const PG_URL = `postgres://postgres@localhost:${PG.port}/postgres`;
const lines = [
  `PG_HARNESS_URL=${PG_URL}`,
  `S3_ENDPOINT=http://localhost:${GARAGE.port}`,
  `S3_REGION=${GARAGE.region}`,
  `S3_BUCKET=${GARAGE.bucket}`,
  `S3_ACCESS_KEY=${GARAGE.accessKey}`,
  `S3_SECRET_KEY=${GARAGE.secretKey}`,
  `HARNESS_SMTP_URL=smtp://localhost:${MAILPIT.smtpPort}`,
  `HARNESS_MAILPIT_URL=http://localhost:${MAILPIT.httpPort}`,
];
writeFileSync(ENV_FILE, `${lines.join('\n')}\n`);
console.log(`PG_HARNESS_URL=${PG_URL}`);
console.log(lines.slice(1).join('\n'));
