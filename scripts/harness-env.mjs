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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const HARNESS_CONTAINER = 'simplycms-harness-pg';

function containerRunning() {
  const r = spawnSync(
    'docker',
    ['ps', '--filter', `name=^${HARNESS_CONTAINER}$`, '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  );
  return !r.error && r.status === 0 && r.stdout.trim() === HARNESS_CONTAINER;
}

/** Підхоплює `<root>/.env.harness`, якщо змінну не задано і харнес живий. */
export function loadHarnessEnv(root) {
  if (process.env.PG_HARNESS_URL) return;
  const file = join(root, '.env.harness');
  if (!existsSync(file)) return;
  if (!containerRunning()) {
    console.warn(
      `[harness] .env.harness ігноровано: контейнер ${HARNESS_CONTAINER} не запущено (pnpm harness:up).`,
    );
    return;
  }
  process.loadEnvFile(file);
}
