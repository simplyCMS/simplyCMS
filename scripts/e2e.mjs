#!/usr/bin/env node

/**
 * Playwright E2E — один вхід (`pnpm test:e2e`).
 *
 * Замінює ручний смок із `docs/architecture/test-contours.md` §8: піднімає
 * локальний стек Supabase (`supabase start` + `db reset` — міграції й
 * `supabase/seed.sql`), створює власника-адміна, послідовно ганяє
 * Playwright-специ під `VITE_LOCALE=uk-UA` і `en-US`, гасить стек і повертає
 * ненульовий код при падінні будь-якої локалі.
 *
 * 🔴 Дві локалі — ДВОМА окремими запусками `playwright test` (а не двома
 * Playwright-проєктами з різним env): `webServer` кожного запуску піднімає
 * власний `vite dev`, і два `vite dev` з однієї теки конфліктують за
 * `src/routeTree.gen.ts` і `node_modules/.vite`. Послідовні `execFileSync`
 * гарантують, що перший процес (разом зі своїм `vite dev`) повністю
 * завершився, перш ніж стартує другий.
 *
 * Перевикористовує тулінг локального стека з `scripts/pilot-pack/e2e.mjs`
 * (той самий механізм, що й `pnpm pilot:e2e`) — не другий спосіб піднімати
 * Supabase.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertLocalStackTooling,
  readLocalStack,
  startLocalStack,
  stopLocalStack,
} from './pilot-pack/e2e.mjs';
import { freePort } from './pilot-pack/build.mjs';
import {
  OWNER_EMAIL,
  OWNER_PASSWORD,
  bootstrapOwner,
} from './e2e/bootstrap-owner.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PLAYWRIGHT_BIN = resolve(REPO_ROOT, 'node_modules/.bin/playwright');

/** Локалі прогону — саме в цьому порядку, послідовно. */
const LOCALES = ['uk-UA', 'en-US'];

/** Перевірка ДО важкої роботи: зрозуміле повідомлення замість стектрейсу. */
function assertPlaywrightInstalled() {
  if (!existsSync(PLAYWRIGHT_BIN)) {
    throw new Error(
      'Немає node_modules/.bin/playwright — постав залежності: `pnpm install` ' +
        '(потрібен devDependency `@playwright/test`).',
    );
  }
}

/**
 * Порти локального стека Supabase (`supabase/config.toml`) мають бути вільні.
 *
 * 🔴 Без цієї перевірки прогін падає всередині `supabase start` повідомленням
 * рівня Docker («Bind for 0.0.0.0:54322 failed»), уже піднявши й погасивши
 * половину контейнерів. Причина майже завжди одна й та сама і НЕ стосується
 * цього репо: на машині розробника крутиться стек ІНШОГО проєкту, що зайняв
 * той самий порт. Тому називаємо винуватця на ім'я до того, як щось робити.
 */
function assertStackPortsFree() {
  const PORTS = [
    [54321, 'API gateway'],
    [54322, 'PostgreSQL'],
    [54323, 'Studio'],
    [54324, 'Mailpit'],
  ];

  const busy = [];
  for (const [port, role] of PORTS) {
    let owner = '';
    try {
      owner = execFileSync(
        'docker',
        ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
    } catch {
      // docker недоступний — це вже перевірив assertLocalStackTooling()
    }
    // Контейнери самого стека — не конфлікт: `supabase start` їх перевикористає.
    if (owner && !owner.startsWith('supabase_')) {
      busy.push(`  ${port} (${role}) — зайнято контейнером ${owner}`);
    }
  }

  if (busy.length) {
    throw new Error(
      'Порти локального стека Supabase зайняті чужими контейнерами:\n' +
        busy.join('\n') +
        '\n\nЗвільни їх і повтори:\n' +
        busy
          .map((l) => `  docker stop ${l.split('контейнером ')[1]}`)
          .join('\n') +
        '\n\nАбо зміни порти в `supabase/config.toml` (тоді онови й\n' +
        '`docs/architecture/test-contours.md` §6, де вони задокументовані).',
    );
  }
}

/** Один прогін Playwright під конкретну локаль. `true` — усе пройшло. */
function runPlaywright(locale, { port, stackEnv }) {
  console.log(`\n[e2e] === Playwright, VITE_LOCALE=${locale} ===`);
  const env = {
    ...process.env,
    ...stackEnv,
    VITE_LOCALE: locale,
    E2E_PORT: String(port),
    E2E_OWNER_EMAIL: OWNER_EMAIL,
    E2E_OWNER_PASSWORD: OWNER_PASSWORD,
  };
  try {
    execFileSync(PLAYWRIGHT_BIN, ['test'], {
      cwd: REPO_ROOT,
      env,
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Перевірка тулінгу (supabase CLI, docker) — ДО будь-якої важкої роботи:
  // краще впасти зрозумілим повідомленням за секунду, ніж посеред прогону.
  assertLocalStackTooling();
  assertPlaywrightInstalled();
  assertStackPortsFree();

  const port = await freePort();
  let stackUp = false;
  const failedLocales = [];

  try {
    console.log(
      '[e2e] Локальний стек Supabase: start + db reset (міграції + seed.sql)',
    );
    startLocalStack();
    stackUp = true;

    const stack = readLocalStack(port);

    console.log('[e2e] Власник-адмін: bootstrap через service_role');
    await bootstrapOwner({
      supabaseUrl: stack.env.VITE_SUPABASE_URL,
      serviceRoleKey: stack.serviceRoleKey,
      siteUrl: stack.env.VITE_SITE_URL,
    });

    for (const locale of LOCALES) {
      const ok = runPlaywright(locale, { port, stackEnv: stack.env });
      if (!ok) failedLocales.push(locale);
    }
  } finally {
    // Стек глушимо завжди: інакше контейнери лишаться висіти після падіння.
    if (stackUp) stopLocalStack();
  }

  if (failedLocales.length > 0) {
    console.error(`\n[e2e] Провалені локалі: ${failedLocales.join(', ')}`);
    return 1;
  }
  console.log('\n[e2e] OK — усі локалі пройшли.');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\n[e2e] ${error.message}`);
    process.exit(1);
  },
);
