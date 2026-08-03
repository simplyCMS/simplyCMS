/**
 * Кроки 3-4 пілота: справжній `npm install` із tarball-ів і `vite build`.
 *
 * 🔴 Саме `npm`, а не `pnpm`: у монорепо все резолвиться pnpm-симлінками й
 * hoisted-коренем. npm має інший linker (плоске дерево, реальні теки), тож
 * тільки він доводить, що пакет самодостатній.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

/** `npm install` у скретчі. */
export function npmInstall(storeDir) {
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--loglevel', 'warn'],
    { cwd: storeDir, stdio: 'inherit' },
  );
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
