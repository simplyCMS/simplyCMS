/**
 * Підхоплення `.env.harness` (від `pnpm harness:up`) споживачами PG-харнеса.
 *
 * Чому не голий `loadEnvFile`: файл переживає `harness:down` чи зникнення
 * контейнера, і тоді застарілий URL перекривав ефемерний фолбек `test:schema`
 * гучною помилкою конекта. Тож файл береться лише коли змінну не задано явно
 * І контейнер реально запущений; інакше — один рядок попередження й ігнор.
 * Явно задану `PG_HARNESS_URL` не чіпаємо: вона лишається гучною відповідальністю
 * викликача.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

export const HARNESS_CONTAINER = 'simplycms-harness-pg';

function containerRunning() {
  const r = spawnSync(
    'docker',
    ['ps', '--filter', `name=^${HARNESS_CONTAINER}$`, '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  );
  return !r.error && r.status === 0 && r.stdout.trim() === HARNESS_CONTAINER;
}

/** Ключі S3 стенду: читає лише контрактний набір драйвера s3 (див. `harnessServicesEnv`). */
export const SERVICE_KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
];

/** Живий файл `.env.harness` або `null` (немає файла чи контейнер не запущено). */
function liveHarnessFile(root) {
  const file = join(root, '.env.harness');
  if (!existsSync(file)) return null;
  if (!containerRunning()) {
    console.warn(
      `[harness] .env.harness ігноровано: контейнер ${HARNESS_CONTAINER} не запущено (pnpm harness:up).`,
    );
    return null;
  }
  return parseEnv(readFileSync(file, 'utf8'));
}

/**
 * Підхоплює з `<root>/.env.harness` ЛИШЕ `PG_HARNESS_URL`, якщо змінну не задано і
 * харнес живий.
 *
 * 🔴 `S3_*` звідси НЕ потрапляють у `process.env`: вони переключили б драйвер
 * сховища в усіх споживачів (`getMediaDriver` бере S3, коли група повна), тобто
 * `test:schema`, `db:demo` і `live:smoke` мовчки пішли б у Garage замість диска.
 * Ключі сервісів бере лише той, кому вони потрібні, — `harnessServicesEnv`.
 */
export function loadHarnessEnv(root) {
  if (process.env.PG_HARNESS_URL) return;
  const vars = liveHarnessFile(root);
  if (vars?.PG_HARNESS_URL) process.env.PG_HARNESS_URL = vars.PG_HARNESS_URL;
}

/**
 * Ключі сервісів стенду (S3 Garage) для конкретного споживача: явно задані змінні
 * (CI, ручний запуск) мають пріоритет, інакше — з живого `.env.harness`.
 */
export function harnessServicesEnv(root) {
  const fromFile = liveHarnessFile(root) ?? {};
  return Object.fromEntries(
    SERVICE_KEYS.flatMap((k) => {
      const v = process.env[k] ?? fromFile[k];
      return v === undefined ? [] : [[k, v]];
    }),
  );
}
