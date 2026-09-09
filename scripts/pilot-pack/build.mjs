/**
 * Кроки 3-4 пілота: справжній `pnpm install` із tarball-ів і `vite build`.
 *
 * 🔴 Саме `pnpm`, а не `npm` — і це зміна від зворотного (до 2026-08-08 тут був
 * npm). Первісний аргумент був такий: у монорепо все резолвиться
 * pnpm-симлінками й hoisted-коренем, тож чужий linker npm (плоске дерево,
 * реальні теки) доводить самодостатність пакета незалежно. Аргумент не
 * витримав перевірки з двох боків:
 *
 *  1. Скретч — НЕ монорепо: тут немає ні workspace-лінків, ні hoisted-кореня.
 *     Ізольована розкладка pnpm перевіряє самодостатність не гірше, а СТРОГІШЕ:
 *     недекларована залежність під pnpm не резолвиться взагалі, тоді як плоске
 *     дерево npm ховало її хойстингом.
 *  2. Магазин декларує `packageManager: pnpm@11.20.0`, а політики pnpm 11
 *     (`allowBuilds`, `minimumReleaseAge`) під npm — мовчазний no-op. Саме це
 *     сховало дефект `allowBuilds`, який поїхав у реліз `0.2.0` і ламав збірку
 *     магазину в реальних користувачів.
 *
 * Свідома втрата: плоске дерево як незалежний спосіб доказу більше не
 * використовується. Статичний напарник на цю роль — `scripts/audit-deps.mjs`.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

/**
 * `pnpm install` у скретчі.
 *
 * 🔴 `--no-frozen-lockfile` обовʼязковий: overrides записуються в lockfile
 * окремою секцією і звіряються при frozen-install, а пілот щоразу підставляє
 * нові абсолютні шляхи tarball-ів. У режимі `--reuse` (тека переживає прогін)
 * frozen впав би з `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
 *
 * 🔴 Прапорців приглушення виводу тут немає навмисно: `--loglevel warn` сховав
 * би саме те, заради чого міграція й робилась — `ERR_PNPM_IGNORED_BUILDS` і
 * попередження про проігноровані поля конфігурації. `--ignore-scripts` теж не
 * додавати: він обійшов би `allowBuilds`, тобто рівно ту політику, яку пілот
 * має довести.
 */
export function pnpmInstall(storeDir) {
  execFileSync('pnpm', ['install', '--no-frozen-lockfile'], {
    cwd: storeDir,
    stdio: 'inherit',
  });
}

/** `vite build` у скретчі — локальним бінарником, без npx-довантажень. */
export function viteBuild(storeDir) {
  execFileSync(join(storeDir, 'node_modules/.bin/vite'), ['build'], {
    cwd: storeDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

/** Вільний TCP-порт (ядро видає його само, потім одразу звільняємо). */
export function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/**
 * Підняти production-runner скретча (`node server.mjs`) і дочекатися готовності.
 *
 * @returns {Promise<{ stop: () => void; logs: () => string }>}
 */
export async function startStore(storeDir, port) {
  let logs = '';
  const child = spawn('node', ['server.mjs'], {
    cwd: storeDir,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => (logs += chunk));
  child.stderr.on('data', (chunk) => (logs += chunk));

  const stop = () => child.kill('SIGTERM');
  const exited = new Promise((_, reject) =>
    child.once('exit', (code) =>
      reject(new Error(`server.mjs вийшов з кодом ${code}\n${logs}`)),
    ),
  );

  await Promise.race([waitReady(port), exited]);
  return { stop, logs: () => logs };
}

/** Опитує порт, доки сервер не почне відповідати (до ~30 с). */
async function waitReady(port) {
  for (let i = 0; i < 150; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/health`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Скретч-сервер не піднявся на порту ${port}`);
}
