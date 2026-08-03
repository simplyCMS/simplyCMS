/**
 * Локальний стек Supabase для режиму `--e2e`.
 *
 * 🔴 Сенс режиму: зробити Gate B детерміністичним. Проти довільної бази він
 * бере очікувані назви з ЖИВОЇ БД, тож червонів на зміну даних без жодної
 * регресії коду. Тут база піднімається з нуля (`supabase start` + `db reset`),
 * міграції та `supabase/seed.sql` дають рівно ті рядки, які описані у
 * `seed-fixtures.mjs`, — і гейт асертить конкретні назви.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** Спільні опції запуску CLI: завжди від кореня репо (там лежить supabase/). */
const RUN_OPTS = { cwd: REPO_ROOT, stdio: 'inherit' };

/**
 * Перевірка інструментів ДО будь-якої важкої роботи.
 *
 * Повідомлення мають називати конкретну дію: невиразний stack trace із надр
 * CLI не пояснює, що саме поставити.
 */
export function assertLocalStackTooling() {
  requireBinary(
    'supabase',
    'Supabase CLI — https://supabase.com/docs/guides/cli/getting-started',
  );
  requireBinary(
    'docker',
    'Docker Engine — https://docs.docker.com/engine/install/',
  );

  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (info.status !== 0) {
    throw new Error(
      'Docker встановлено, але демон не відповідає. Запусти його ' +
        '(`sudo systemctl start docker`) і перевір доступ поточного ' +
        'користувача (`docker info`). Гейти пакувальності Docker не ' +
        'потребують — це `pnpm pilot:pack`.',
    );
  }
}

/** Наявність бінарника в PATH; ENOENT → зрозуміла інструкція, що ставити. */
function requireBinary(binary, hint) {
  const probe = spawnSync(binary, ['--version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      `Режим --e2e потребує \`${binary}\`, але його немає в PATH. ` +
        `Встав: ${hint}. Без нього доступні лише гейти пакувальності — ` +
        '`pnpm pilot:pack`.',
    );
  }
}

/**
 * Підняти стек і привести БД до відомого стану.
 *
 * `db reset` виконується навіть після свіжого `start` (який теж проганяє
 * міграції та сід): стек міг лишитися з попереднього прогону з брудними
 * даними, а детермінізм гейта важливіший за кілька секунд.
 */
export function startLocalStack() {
  execFileSync('supabase', ['start'], RUN_OPTS);
  execFileSync('supabase', ['db', 'reset', '--yes'], RUN_OPTS);
}

/**
 * Зупинити стек. `--no-backup` прибирає томи: наступний прогін має починатися
 * з чистої БД, а не з даних попереднього.
 *
 * Викидати помилку звідси не можна — виклик іде з `finally`, і виняток
 * замаскував би справжню причину падіння пілота.
 */
export function stopLocalStack() {
  try {
    execFileSync('supabase', ['stop', '--no-backup'], RUN_OPTS);
  } catch (error) {
    console.error(
      `[pilot] Не вдалося зупинити локальний стек: ${error.message}\n` +
        'Прибери його вручну: supabase stop --no-backup',
    );
  }
}

/**
 * Env скретч-магазину з живого стеку — машинно, без ручного копіювання ключів.
 *
 * @param {number} port порт, на якому підніметься магазин
 */
export function readLocalStackEnv(port) {
  const status = readStatusJson();
  const url = status.API_URL;
  const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (!url || !key) {
    throw new Error(
      '`supabase status -o json` не віддав API_URL і ключ (PUBLISHABLE_KEY/' +
        `ANON_KEY). Отримані ключі: ${Object.keys(status).join(', ') || '—'}`,
    );
  }
  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: key,
    VITE_SUPABASE_PUBLISHABLE_KEY: key,
    VITE_SITE_URL: `http://127.0.0.1:${port}`,
  };
}

/** JSON зі `supabase status`; CLI домішує нотатки, тому вирізаємо об'єкт. */
function readStatusJson() {
  const raw = execFileSync('supabase', ['status', '-o', 'json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Несподіваний вивід \`supabase status -o json\`:\n${raw}`);
  }
  return JSON.parse(raw.slice(start, end + 1));
}
