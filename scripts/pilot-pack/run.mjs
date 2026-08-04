/**
 * Складання скретч-магазину й прогін гейтів.
 *
 * Винесено з `pilot-pack.mjs`: там лишається лише вибір режиму (звідки взяти
 * env і чи піднімати локальний стек), тут — незмінна для всіх режимів
 * послідовність pack → scaffold → npm install → vite build → gates.
 */

import { buildPackages, packAll } from './pack.mjs';
import { scaffoldStore } from './scaffold.mjs';
import { npmInstall, startStore, viteBuild } from './build.mjs';
import { gateRoutes } from './gate-a.mjs';
import { gateHttp } from './gate-b.mjs';
import { gateBundle } from './gate-c.mjs';
import { gateTailwind } from './gate-d.mjs';
import { createPkgSmoke } from './create-pkg-smoke.mjs';

/** Заголовок кроку — щоб лог пілота читався зверху вниз. */
export function step(title) {
  console.log(`\n[1m▸ ${title}[0m`);
}

/**
 * @param {{
 *   storeDir: string; tarballDir: string; port: number;
 *   env: Record<string,string>; reuse: boolean; skipBuild: boolean;
 *   packOnly: boolean; expectedNames: string[] | null;
 * }} opts
 * @returns {Promise<[string, { ok: boolean; details: string[] }][]>}
 */
export async function runGates(opts) {
  if (!opts.reuse) await prepareStore(opts);

  const results = [];
  step('Gate A — роути з node_modules');
  results.push(['A', gateRoutes(opts.storeDir)]);

  step('Gate C — bundle-guard + splitting');
  results.push(['C', gateBundle(opts.storeDir)]);

  step('Gate D — Tailwind бачить пакети');
  results.push(['D', gateTailwind(opts.storeDir)]);

  // Gate CLI не залежить ні від БД, ні від скретча — тому в гілці, яка йде
  // завжди, включно з `--pack-only`.
  step('Gate CLI — tarball скаффолдера');
  results.push(['CLI', createPkgSmoke()]);

  if (!opts.packOnly) results.push(['B', await runGateB(opts)]);
  return results;
}

/** pack → scaffold → npm install → vite build. */
async function prepareStore({ storeDir, tarballDir, env, skipBuild }) {
  if (!skipBuild) {
    step('Збірка пакетів ядра');
    buildPackages();
  }

  step('pnpm pack — tarball-и');
  const tarballs = packAll(tarballDir);
  console.log(`  спаковано ${tarballs.size} пакетів → ${tarballDir}`);

  step(`Розгортання скретч-магазину → ${storeDir}`);
  scaffoldStore({ storeDir, tarballs, env });

  step('npm install із tarball-ів');
  npmInstall(storeDir);

  step('vite build');
  viteBuild(storeDir);
}

/** Gate B — підняти production-runner скретча і відпустити його в `finally`. */
async function runGateB({ storeDir, port, env, expectedNames }) {
  step(`Gate B — production-запуск на порту ${port}`);
  const server = await startStore(storeDir, port);
  try {
    return await gateHttp(port, env, { expectedNames });
  } finally {
    server.stop();
  }
}
