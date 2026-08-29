#!/usr/bin/env node

/**
 * Пілот пакування (Фаза 1, Task 3.1) — однією командою.
 *
 * Збирає пакети ядра, пакує їх у справжні tarball-и (`pnpm pack`), розгортає
 * у /tmp окремий магазин БЕЗ жодного workspace-аліаса, ставить ядро туди
 * справжнім `pnpm install` із цих tarball-ів, збирає (`vite build`) і проганяє
 * гейти.
 *
 * 🔴 Режими розділені за ПРИРОДОЮ перевірки, бо змішувати їх — значить робити
 * детерміністичний гейт заручником даних:
 *
 * | Режим              | Команда           | Гейти              | Джерело даних     |
 * |--------------------|-------------------|--------------------|-------------------|
 * | пакувальність      | `pnpm pilot:pack` | A, C, D, CLI, TOOL | нічого (без БД)   |
 * | повний (проти БД)  | `pnpm pilot`      | A-D, CLI, TOOL     | `.env.local`      |
 *
 * 🔴 Режиму `--e2e` більше немає: він піднімав локальний стек Supabase, а
 * магазин контракту v2 ходить у чистий Postgres — стек не був би ні джерелом
 * даних магазину, ні джерелом auth. Разом із ним знято Gate E (bootstrap
 * власника через service_role): owner-флоу на Better Auth повертає контур К6.
 *
 * A/C/D, CLI і TOOL (резолв tarball-ів, route tree з node_modules, відсутність
 * серверного вантажу в клієнті, Tailwind, вміст tarball-ів скаффолдера й
 * @simplycms/cli) до БД не звертаються — тому `--pack-only` не потребує ані
 * ключів, ані піднятого сервера й ніколи не червоніє через зміну даних. Gate B
 * бере назви товарів із живої бази за `DATABASE_URL`, тому там достатньо збігу
 * хоч однієї назви: більшого про чужі дані сказати не можна.
 *
 * Використання:
 *   node scripts/pilot-pack.mjs               # повний прогін (потрібна БД)
 *   node scripts/pilot-pack.mjs --pack-only   # gates A, C, D, CLI, TOOL (без БД)
 *   node scripts/pilot-pack.mjs --keep        # не прибирати /tmp-магазин
 *   node scripts/pilot-pack.mjs --skip-build  # dist пакетів уже свіжий
 *   node scripts/pilot-pack.mjs --reuse       # без pack/install, лише гейти
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePilotEnv } from './pilot-pack/env.mjs';
import { freePort } from './pilot-pack/build.mjs';
import { runGates } from './pilot-pack/run.mjs';
import { report, step } from './pilot-pack/report.mjs';

const ROOT = join(tmpdir(), 'simplycms-pilot');
const STORE_DIR = join(ROOT, 'store');
const TARBALL_DIR = join(ROOT, 'tarballs');

const keep = process.argv.includes('--keep');
const reuse = process.argv.includes('--reuse');
const packOnly = process.argv.includes('--pack-only');
const skipBuild = process.argv.includes('--skip-build');

/**
 * Порт для `VITE_SITE_URL` у режимі `--pack-only`: сервер не піднімається, а
 * випадковий порт зробив би бандл невідтворюваним між прогонами.
 */
const PACK_ONLY_PORT = 3000;

/** Людський опис активного режиму для шапки логу. */
function describeMode() {
  return packOnly
    ? `--pack-only (${describeScope()}, без БД)`
    : `повний (${describeScope()}, проти живої БД)`;
}

/** Набір гейтів режиму — той самий рядок у шапці й у підсумку. */
function describeScope() {
  return packOnly ? 'гейти A/C/D + CLI/TOOL' : 'гейти A-D + CLI/TOOL (E знято)';
}

async function main() {
  // Прапорець знято разом із локальним стеком Supabase. Мовчазне ігнорування
  // дало б прогін, який виглядає як e2e, але ним не є, — тому падаємо.
  if (process.argv.includes('--e2e')) {
    throw new Error(
      'Режим --e2e знято: він піднімав локальний стек Supabase, а магазин ' +
        'контракту v2 працює на чистому Postgres. E2E-контур (разом із Gate E ' +
        '— bootstrap власника на Better Auth) повертає трек К6. Доступні ' +
        'режими: `pnpm pilot:pack` і `pnpm pilot`.',
    );
  }

  const port = packOnly ? PACK_ONLY_PORT : await freePort();
  try {
    const env = resolvePilotEnv(port, { requireDb: !packOnly });
    step(`Режим: ${describeMode()}`);

    const results = await runGates({
      storeDir: STORE_DIR,
      tarballDir: TARBALL_DIR,
      port,
      env,
      reuse,
      skipBuild,
      packOnly,
    });
    return report(results, { scope: describeScope() });
  } finally {
    if (!keep) rmSync(STORE_DIR, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n[31m[pilot] ${error.message}[0m`);
    process.exit(1);
  },
);
