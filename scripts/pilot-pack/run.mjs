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
import { checkStrippedEnvParity } from './stripped-env.mjs';
import { gateMedia } from './gate-media.mjs';
import { gateMail } from './gate-mail.mjs';
import { gateServerBundle } from './gate-sb.mjs';
import { gateTailwind } from './gate-d.mjs';
import { gateImportProtection } from './gate-ip.mjs';
import { createPkgSmoke } from './create-pkg-smoke.mjs';
import { checkSessionHookOnScratch } from './session-hook-checks.mjs';
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
  // Межа клієнт/сервер і парність `STRIPPED_ENV` (server.mjs скретча ↔ ядро з
  // tarball-а): обидва про те, що server-only знання не розходяться в магазині.
  const bundle = gateBundle(opts.storeDir);
  const stripped = checkStrippedEnvParity(opts.storeDir);
  results.push([
    'C',
    {
      ok: bundle.ok && stripped.ok,
      details: [...bundle.details, ...stripped.details],
    },
  ]);

  step('Gate SB — що вклеєно в серверний бандл');
  results.push(['SB', gateServerBundle(opts.storeDir)]);

  step('Gate D — Tailwind бачить пакети');
  results.push(['D', gateTailwind(opts.storeDir)]);

  // Gate CLI і tarball-частина Gate TOOL не потребують ні БД, ні скретча; крок шима
  // використовує встановлений скретч, але БД теж не потребує — тож гілка йде завжди,
  // включно з `--pack-only`.
  step('Gate CLI — tarball скаффолдера');
  results.push(['CLI', createPkgSmoke()]);

  step('Gate TOOL — tarball @simplycms/cli');
  const tool = await toolPkgSmoke();
  // Шим хука — на встановленому скретчі: лише там він доходить до справжнього CLI.
  const hook = checkSessionHookOnScratch(opts.storeDir);
  results.push([
    'TOOL',
    { ok: tool.ok && hook.ok, details: [...tool.details, ...hook.details] },
  ]);

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

  // MEDIA і MAIL — запаковане ядро проти Garage і Mailpit (К3-Е8, Task 13). Після
  // B, бо їм потрібен лише скретч, а не живий сервер; у `--pack-only` — skip із
  // причиною, щоб звіт показував, що їх не ганяли.
  step('Gate MEDIA — драйвер s3 запакованого ядра проти Garage');
  results.push(['MEDIA', await gateMedia(opts.storeDir, opts.env, opts)]);
  step('Gate MAIL — SMTP-драйвер запакованого ядра проти Mailpit');
  results.push(['MAIL', await gateMail(opts.storeDir, opts.env, opts)]);

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
    const execve = checkExecve(server.pid, server.logs(), {
      smtp: Boolean(env.SMTP_URL),
    });
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
