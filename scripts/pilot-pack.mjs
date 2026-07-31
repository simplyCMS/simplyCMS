#!/usr/bin/env node

/**
 * Пілот пакування (Фаза 1, Task 3.1) — однією командою.
 *
 * Збирає пакети ядра, пакує їх у справжні tarball-и (`pnpm pack`), розгортає
 * у /tmp окремий магазин БЕЗ жодного workspace-аліаса, ставить ядро туди
 * справжнім `npm install` із цих tarball-ів, збирає (`vite build`), піднімає
 * production-runner і проганяє gates A-D.
 *
 * Використання:
 *   node scripts/pilot-pack.mjs               # повний прогін
 *   node scripts/pilot-pack.mjs --keep        # не прибирати /tmp-магазин
 *   node scripts/pilot-pack.mjs --skip-build  # dist пакетів уже свіжий
 *   node scripts/pilot-pack.mjs --reuse       # без pack/install, лише гейти
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPackages, packAll } from './pilot-pack/pack.mjs';
import { resolvePilotEnv, scaffoldStore } from './pilot-pack/scaffold.mjs';
import {
  freePort,
  npmInstall,
  startStore,
  viteBuild,
} from './pilot-pack/build.mjs';
import { gateRoutes } from './pilot-pack/gate-a.mjs';
import { gateHttp } from './pilot-pack/gate-b.mjs';
import { gateBundle } from './pilot-pack/gate-c.mjs';
import { gateTailwind } from './pilot-pack/gate-d.mjs';

const ROOT = join(tmpdir(), 'simplycms-pilot');
const STORE_DIR = join(ROOT, 'store');
const TARBALL_DIR = join(ROOT, 'tarballs');

const keep = process.argv.includes('--keep');
const reuse = process.argv.includes('--reuse');

/** Заголовок кроку — щоб лог пілота читався зверху вниз. */
function step(title) {
  console.log(`\n[1m▸ ${title}[0m`);
}

async function main() {
  const port = await freePort();
  const env = resolvePilotEnv(port);
  if (!env.VITE_SUPABASE_URL) {
    throw new Error(
      'Немає ключів Supabase: очікую .env.local у корені або PILOT_SUPABASE_URL/PILOT_SUPABASE_KEY',
    );
  }

  if (!reuse) {
    if (!process.argv.includes('--skip-build')) {
      step('Збірка пакетів ядра');
      buildPackages();
    }

    step('pnpm pack — tarball-и');
    const tarballs = packAll(TARBALL_DIR);
    console.log(`  спаковано ${tarballs.size} пакетів → ${TARBALL_DIR}`);

    step(`Розгортання скретч-магазину → ${STORE_DIR}`);
    scaffoldStore({ storeDir: STORE_DIR, tarballs, env });

    step('npm install із tarball-ів');
    npmInstall(STORE_DIR);

    step('vite build');
    viteBuild(STORE_DIR);
  }

  const results = [];
  step('Gate A — роути з node_modules');
  results.push(['A', gateRoutes(STORE_DIR)]);

  step('Gate C — bundle-guard + splitting');
  results.push(['C', gateBundle(STORE_DIR)]);

  step('Gate D — Tailwind бачить пакети');
  results.push(['D', gateTailwind(STORE_DIR)]);

  step(`Gate B — production-запуск на порту ${port}`);
  const server = await startStore(STORE_DIR, port);
  try {
    results.push(['B', await gateHttp(port, env)]);
  } finally {
    server.stop();
  }

  return report(results);
}

/** Друк підсумку + код виходу. */
function report(results) {
  console.log('\n[1m═ Підсумок пілота ═[0m');
  let failed = 0;
  for (const [name, { ok, details }] of results.sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`\nGate ${name}: ${ok ? '[32mPASS[0m' : '[31mFAIL[0m'}`);
    for (const line of details) console.log(`  ${line}`);
    if (!ok) failed += 1;
  }
  if (!keep) rmSync(STORE_DIR, { recursive: true, force: true });
  console.log(
    failed === 0
      ? '\n[32mПілот пройдено: gates A-D зелені.[0m'
      : `\n[31mПілот НЕ пройдено: провалено гейтів — ${failed}.[0m`,
  );
  return failed === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n[31m[pilot] ${error.message}[0m`);
    process.exit(1);
  },
);
