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
import { checkExecve, checkPartialEnv, gateHttp } from './gate-b.mjs';
import { gateBundle } from './gate-c.mjs';
import { gateServerBundle } from './gate-sb.mjs';
import { gateTailwind } from './gate-d.mjs';
import { gateImportProtection } from './gate-ip.mjs';
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

  step('Gate SB — що вклеєно в серверний бандл');
  results.push(['SB', gateServerBundle(opts.storeDir)]);

  step('Gate D — Tailwind бачить пакети');
  results.push(['D', gateTailwind(opts.storeDir)]);

  // Gate CLI і Gate TOOL не залежать ні від БД, ні від скретча — тому в
  // гілці, яка йде завжди, включно з `--pack-only`.
  step('Gate CLI — tarball скаффолдера');
  results.push(['CLI', createPkgSmoke()]);

  step('Gate TOOL — tarball @simplycms/cli');
  results.push(['TOOL', await toolPkgSmoke()]);

  // Gate E (bootstrap власника) знято разом із локальним стеком БД —
  // він жив на service-ключі сервісу автентифікації. Рядок лишається видимим, щоб звіт
  // не виглядав так, ніби owner-флоу колись покривався й тихо зник.
  results.push([
    'E',
    skippedGate(
      'Gate E — знято разом зі стеком БД: owner-флоу на Better Auth ' +
        'повертає контур К6',
    ),
  ]);

  // Gate B потребує живого сервера і живої БД, тож у `--pack-only` не існує.
  if (!opts.packOnly) results.push(await gateServer(opts));

  // 🔴 Останнім: кожна червона збірка спорожнює dist скретча, а Gate C/D і
  // Gate B читають його. Гейт сам перезбирає скретч наприкінці.
  step('Gate IP — Import Protection валить витік у збірці магазину');
  results.push(['IP', gateImportProtection(opts.storeDir)]);
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
  // Старт — через прод-скрипт магазину (Е8-Р6): накат під «паролем власника»
  // (тут це той самий DSN) і execve на server.mjs без нього.
  const server = await startStore(
    storeDir,
    port,
    // start.mjs `.env` не читає, тож усі три ключі скретча йдуть через env процесу.
    {
      ...env,
      MIGRATION_DATABASE_URL: env.DATABASE_URL,
    },
    { entry: 'scripts/start.mjs' },
  );
  try {
    const http = await gateHttp(port, env);
    const execve = checkExecve(server.pid, server.logs());
    const partial = checkPartialEnv(storeDir, env);
    return [
      'B',
      {
        ok: http.ok && execve.ok && partial.ok,
        details: [...http.details, ...execve.details, ...partial.details],
      },
    ];
  } finally {
    server.stop();
  }
}
