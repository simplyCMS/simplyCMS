#!/usr/bin/env node

/**
 * Пілот пакування (Фаза 1, Task 3.1) — однією командою.
 *
 * Збирає пакети ядра, пакує їх у справжні tarball-и (`pnpm pack`), розгортає
 * у /tmp окремий магазин БЕЗ жодного workspace-аліаса, ставить ядро туди
 * справжнім `npm install` із цих tarball-ів, збирає (`vite build`) і проганяє
 * гейти.
 *
 * 🔴 Режими розділені за ПРИРОДОЮ перевірки, бо змішувати їх — значить робити
 * детерміністичний гейт заручником даних:
 *
 * | Режим              | Команда           | Гейти   | Джерело даних            |
 * |--------------------|-------------------|---------|--------------------------|
 * | пакувальність      | `pnpm pilot:pack` | A, C, D | нічого (плейсхолдери)    |
 * | повний (проти БД)  | `pnpm pilot`      | A-D     | `.env.local` / секрети   |
 * | e2e на сіді        | `pnpm pilot:e2e`  | —       | ще не реалізовано        |
 *
 * A/C/D (резолв tarball-ів, route tree з node_modules, відсутність серверного
 * вантажу в клієнті, Tailwind) до БД не звертаються — тому `--pack-only` не
 * потребує ані ключів, ані піднятого сервера й ніколи не червоніє через зміну
 * даних. Gate B бере очікувані назви товарів із ЖИВОЇ бази, тож живе лише в
 * повному режимі; його детерміністичну заміну на сіді додасть `pilot:e2e`.
 *
 * Використання:
 *   node scripts/pilot-pack.mjs               # повний прогін (потрібна БД)
 *   node scripts/pilot-pack.mjs --pack-only   # лише gates A, C, D (без БД)
 *   node scripts/pilot-pack.mjs --keep        # не прибирати /tmp-магазин
 *   node scripts/pilot-pack.mjs --skip-build  # dist пакетів уже свіжий
 *   node scripts/pilot-pack.mjs --reuse       # без pack/install, лише гейти
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPackages, packAll } from './pilot-pack/pack.mjs';
import { scaffoldStore } from './pilot-pack/scaffold.mjs';
import { resolvePilotEnv } from './pilot-pack/env.mjs';
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
const packOnly = process.argv.includes('--pack-only');

/**
 * Порт для `VITE_SITE_URL` у режимі `--pack-only`: сервер не піднімається, а
 * випадковий порт зробив би бандл невідтворюваним між прогонами.
 */
const PACK_ONLY_PORT = 3000;

/** Заголовок кроку — щоб лог пілота читався зверху вниз. */
function step(title) {
  console.log(`\n[1m▸ ${title}[0m`);
}

async function main() {
  const port = packOnly ? PACK_ONLY_PORT : await freePort();
  const env = resolvePilotEnv(port, { requireSupabase: !packOnly });
  console.log(
    packOnly
      ? '[1m▸ Режим: --pack-only (гейти A/C/D, без Supabase)[0m'
      : '[1m▸ Режим: повний (гейти A-D, проти живої БД)[0m',
  );

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

  if (!packOnly) {
    step(`Gate B — production-запуск на порту ${port}`);
    const server = await startStore(STORE_DIR, port);
    try {
      results.push(['B', await gateHttp(port, env)]);
    } finally {
      server.stop();
    }
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
  const scope = packOnly ? 'gates A/C/D' : 'gates A-D';
  console.log(
    failed === 0
      ? `\n[32mПілот пройдено: ${scope} зелені.[0m`
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
