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
 * | Режим              | Команда           | Гейти   | Джерело даних             |
 * |--------------------|-------------------|---------|---------------------------|
 * | пакувальність      | `pnpm pilot:pack` | A, C, D | нічого (плейсхолдери)     |
 * | повний (проти БД)  | `pnpm pilot`      | A-D     | `.env.local` / секрети    |
 * | e2e на сіді        | `pnpm pilot:e2e`  | A-D     | локальний стек + seed.sql |
 *
 * A/C/D (резолв tarball-ів, route tree з node_modules, відсутність серверного
 * вантажу в клієнті, Tailwind) до БД не звертаються — тому `--pack-only` не
 * потребує ані ключів, ані піднятого сервера й ніколи не червоніє через зміну
 * даних. Gate B бере назви товарів із бази: у `pilot` — з чужої живої (тому
 * достатньо збігу хоч однієї назви), у `pilot:e2e` — із детерміністичного сіду
 * (`supabase/seed.sql`), тому очікування там ТОЧНІ.
 *
 * Використання:
 *   node scripts/pilot-pack.mjs               # повний прогін (потрібна БД)
 *   node scripts/pilot-pack.mjs --pack-only   # лише gates A, C, D (без БД)
 *   node scripts/pilot-pack.mjs --e2e         # gates A-D проти локального стеку
 *   node scripts/pilot-pack.mjs --keep        # не прибирати /tmp-магазин
 *   node scripts/pilot-pack.mjs --skip-build  # dist пакетів уже свіжий
 *   node scripts/pilot-pack.mjs --reuse       # без pack/install, лише гейти
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolvePilotEnv } from './pilot-pack/env.mjs';
import {
  assertLocalStackTooling,
  readLocalStackEnv,
  startLocalStack,
  stopLocalStack,
} from './pilot-pack/e2e.mjs';
import { seedProductNames } from './pilot-pack/seed-fixtures.mjs';
import { freePort } from './pilot-pack/build.mjs';
import { runGates, step } from './pilot-pack/run.mjs';
import { report } from './pilot-pack/report.mjs';

const ROOT = join(tmpdir(), 'simplycms-pilot');
const STORE_DIR = join(ROOT, 'store');
const TARBALL_DIR = join(ROOT, 'tarballs');

const keep = process.argv.includes('--keep');
const reuse = process.argv.includes('--reuse');
const packOnly = process.argv.includes('--pack-only');
const e2e = process.argv.includes('--e2e');
const skipBuild = process.argv.includes('--skip-build');

/**
 * Порт для `VITE_SITE_URL` у режимі `--pack-only`: сервер не піднімається, а
 * випадковий порт зробив би бандл невідтворюваним між прогонами.
 */
const PACK_ONLY_PORT = 3000;

/** Людський опис активного режиму для шапки логу. */
function describeMode() {
  if (packOnly) return '--pack-only (гейти A/C/D, без Supabase)';
  if (e2e) return '--e2e (гейти A-D, локальний стек + детерміністичний сід)';
  return 'повний (гейти A-D, проти живої БД)';
}

async function main() {
  if (packOnly && e2e) {
    throw new Error('--pack-only і --e2e взаємовиключні: обери один режим.');
  }
  // Перевірка тулінгу — ДО важкої роботи: краще впасти зрозумілим
  // повідомленням за секунду, ніж після кількох хвилин збірки.
  if (e2e) assertLocalStackTooling();

  const port = packOnly ? PACK_ONLY_PORT : await freePort();
  let stackUp = false;
  try {
    if (e2e) {
      step('Локальний стек Supabase: start + db reset (міграції + seed.sql)');
      startLocalStack();
      stackUp = true;
    }
    const env = e2e
      ? readLocalStackEnv(port)
      : resolvePilotEnv(port, { requireSupabase: !packOnly });
    step(`Режим: ${describeMode()}`);

    const results = await runGates({
      storeDir: STORE_DIR,
      tarballDir: TARBALL_DIR,
      port,
      env,
      reuse,
      skipBuild,
      packOnly,
      expectedNames: e2e ? seedProductNames() : null,
    });
    return report(results, { scope: packOnly ? 'gates A/C/D' : 'gates A-D' });
  } finally {
    // 🔴 Стек глушимо завжди: інакше контейнери лишаться висіти після падіння.
    if (stackUp) stopLocalStack();
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
