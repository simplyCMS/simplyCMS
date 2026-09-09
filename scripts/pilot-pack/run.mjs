/**
 * Складання скретч-магазину й прогін гейтів.
 *
 * Винесено з `pilot-pack.mjs`: там лишається лише вибір режиму (звідки взяти
 * env), тут — прогін гейтів у порядку, спільному для всіх режимів. Підготовку самого магазину робить `prepare-store.mjs`.
 */

import { startStore } from './build.mjs';
import { prepareStore } from './prepare-store.mjs';
import { skippedGate, step } from './report.mjs';
import { gateRoutes } from './gate-a.mjs';
import { gateHttp } from './gate-b.mjs';
import { gateBundle } from './gate-c.mjs';
import { gateTailwind } from './gate-d.mjs';
import { createPkgSmoke } from './create-pkg-smoke.mjs';
import { toolPkgSmoke } from './tool-pkg-smoke.mjs';

/**
 * @param {{
 *   storeDir: string; tarballDir: string; port: number;
 *   env: Record<string,string>; reuse: boolean; skipBuild: boolean;
 *   packOnly: boolean;
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

  // Gate CLI і Gate TOOL не залежать ні від БД, ні від скретча — тому в
  // гілці, яка йде завжди, включно з `--pack-only`.
  step('Gate CLI — tarball скаффолдера');
  results.push(['CLI', createPkgSmoke()]);

  step('Gate TOOL — tarball @simplycms/cli');
  results.push(['TOOL', await toolPkgSmoke()]);

  // Gate E (bootstrap власника) знято разом із локальним стеком Supabase —
  // він жив на service_role-ключі GoTrue. Рядок лишається видимим, щоб звіт
  // не виглядав так, ніби owner-флоу колись покривався й тихо зник.
  results.push([
    'E',
    skippedGate(
      'Gate E — знято разом зі стеком Supabase: owner-флоу на Better Auth ' +
        'повертає контур К6',
    ),
  ]);

  // Gate B потребує живого сервера і живої БД, тож у `--pack-only` не існує.
  if (!opts.packOnly) results.push(await gateServer(opts));
  return results;
}

/**
 * Gate B — єдиний гейт, якому потрібен ЖИВИЙ сервер скретча: він піднімається
 * тут і гаситься у `finally`, щоб процес не лишався висіти після падіння.
 *
 * @returns {Promise<[string, { ok: boolean; details: string[] }]>}
 */
async function gateServer({ storeDir, port, env }) {
  step(`Gate B — production-запуск на порту ${port}`);
  const server = await startStore(storeDir, port);
  try {
    return ['B', await gateHttp(port, env)];
  } finally {
    server.stop();
  }
}
