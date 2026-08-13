/**
 * Складання скретч-магазину й прогін гейтів.
 *
 * Винесено з `pilot-pack.mjs`: там лишається лише вибір режиму (звідки взяти
 * env і чи піднімати локальний стек), тут — незмінна для всіх режимів
 * послідовність pack → scaffold → pnpm install → провенанс → vite build → gates.
 */

import { buildPackages, packAll } from './pack.mjs';
import { scaffoldStore } from './scaffold.mjs';
import { pnpmInstall, startStore, viteBuild } from './build.mjs';
import { assertTarballProvenance } from './provenance.mjs';
import { gateRoutes } from './gate-a.mjs';
import { gateHttp } from './gate-b.mjs';
import { gateBundle } from './gate-c.mjs';
import { gateTailwind } from './gate-d.mjs';
import { gateOwner, skippedOwnerGate } from './gate-e.mjs';
import { createPkgSmoke } from './create-pkg-smoke.mjs';
import { toolPkgSmoke } from './tool-pkg-smoke.mjs';

/** Заголовок кроку — щоб лог пілота читався зверху вниз. */
export function step(title) {
  console.log(`\n[1m▸ ${title}[0m`);
}

/**
 * @param {{
 *   storeDir: string; tarballDir: string; port: number;
 *   env: Record<string,string>; reuse: boolean; skipBuild: boolean;
 *   packOnly: boolean; expectedNames: string[] | null;
 *   serviceRoleKey: string | null;
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
  results.push(['TOOL', toolPkgSmoke()]);

  if (opts.packOnly) {
    // Gate B у `--pack-only` не існує (сервер не піднімається), а Gate E має
    // бути ВИДИМО пропущений: мовчазна відсутність рядка читається як «немає
    // такого гейта», а не «не перевірялось у цьому режимі».
    results.push([
      'E',
      skippedOwnerGate(
        'Gate E — пропущено: --pack-only не піднімає ні сервер, ні БД',
      ),
    ]);
  } else {
    results.push(...(await runServerGates(opts)));
  }
  return results;
}

/** pack → scaffold → pnpm install → провенанс → vite build. */
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

  step('pnpm install із tarball-ів');
  pnpmInstall(storeDir);

  // 🔴 Не гейт, а ПЕРЕДУМОВА: якщо ядро приїхало з реєстру замість tarball-ів,
  // усе далі втрачає сенс — гейти перевірятимуть уже опубліковані пакети
  // замість тих, що йдуть на публікацію. Відмова механізму overrides під pnpm
  // мовчазна, тому вона мусить мати власний голос саме тут.
  step('Провенанс — ядро з локальних tarball-ів');
  const provenance = assertTarballProvenance(storeDir, [...tarballs.keys()]);
  for (const line of provenance.details) console.log(`  ${line}`);
  if (!provenance.ok) {
    throw new Error(
      'Провенанс не підтверджено: пакети ядра приїхали не з tarball-ів. ' +
        'Перевір блок `overrides:` у pnpm-workspace.yaml скретча.',
    );
  }

  step('vite build');
  viteBuild(storeDir);
}

/**
 * Гейти, яким потрібен ЖИВИЙ сервер скретча — Gate B і Gate E.
 *
 * 🔴 Обидва ділять ОДНЕ вікно життя процесу: сервер піднімається тут і гаситься
 * у `finally`. Викликати Gate E після повернення з окремого «runGateB» не можна
 * — сервер там уже вбито, і `fetch('/auth/confirm')` падав би на ECONNREFUSED.
 *
 * @returns {Promise<[string, { ok: boolean; details: string[] }][]>}
 */
async function runServerGates({
  storeDir,
  port,
  env,
  expectedNames,
  serviceRoleKey,
}) {
  step(`Gate B — production-запуск на порту ${port}`);
  const server = await startStore(storeDir, port);
  try {
    const results = [['B', await gateHttp(port, env, { expectedNames })]];

    if (serviceRoleKey) {
      step('Gate E — bootstrap власника');
      results.push([
        'E',
        await gateOwner({ storeDir, port, env, serviceRoleKey }),
      ]);
    } else {
      results.push([
        'E',
        skippedOwnerGate(
          'Gate E — пропущено: потрібен --e2e (service_role-ключ дає лише ' +
            'локальний стек; проти живої БД owner-флоу не ганяємо)',
        ),
      ]);
    }
    return results;
  } finally {
    server.stop();
  }
}
