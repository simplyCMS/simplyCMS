#!/usr/bin/env node

/**
 * Застосування міграцій із `supabase/migrations/` через Supabase CLI
 * і подальша регенерація типів (ланцюжок spec §9).
 *
 * Флоу: `src/schema.ts` → `pnpm db:diff <name>` → ревʼю SQL → `pnpm db:migrate`.
 *
 * Використання:
 *   pnpm db:migrate
 *
 * Змінні оточення (.env.local):
 *   SUPABASE_PROJECT_ID=your-project-ref
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxx
 *   SUPABASE_DB_PASSWORD=…   (потрібен CLI для push)
 *
 * Отримати токен: https://app.supabase.com/account/tokens
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// ── Шляхи + оточення ────────────────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

config({ path: join(ROOT, '.env.local') });
config({ path: join(ROOT, '.env') });

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

/** Оточення для CLI: токен і пароль БД передаються явно. */
const cliEnv = () => ({
  ...process.env,
  SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN,
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD || '',
});

// ── Перевірка передумов ─────────────────────────────────────────────────────
function checkPrerequisites() {
  console.log('🔍 Перевірка передумов...\n');

  try {
    const version = execSync('supabase --version', { encoding: 'utf8' }).trim().split('\n')[0];
    console.log(`  ✅ Supabase CLI: ${version}`);
  } catch {
    console.error('  ❌ Supabase CLI не знайдено!');
    console.log('  💡 Встанови: https://supabase.com/docs/guides/cli/getting-started');
    return false;
  }

  if (!PROJECT_ID) {
    console.error('  ❌ SUPABASE_PROJECT_ID не задано!');
    console.log('  💡 Додай у .env.local: SUPABASE_PROJECT_ID=your-project-ref');
    return false;
  }
  console.log(`  ✅ Project ID: ${PROJECT_ID}`);

  if (!ACCESS_TOKEN) {
    console.error('  ❌ SUPABASE_ACCESS_TOKEN не задано!');
    console.log('  💡 Додай у .env.local: SUPABASE_ACCESS_TOKEN=sbp_xxxx');
    console.log('  💡 Отримай токен: https://app.supabase.com/account/tokens');
    return false;
  }
  console.log('  ✅ Access token: знайдено');

  try {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    console.log(`  ✅ Локальних міграцій: ${files.length}`);
  } catch {
    console.warn('  ⚠️  Директорія міграцій не знайдена');
  }

  console.log();
  return true;
}

/**
 * Запуск CLI-команди, де частина «помилок» — насправді нормальний результат
 * (`already linked`, `Applied`, `up to date`). Тому маркери перевіряються
 * і в stdout, і в stderr.
 */
function runTolerant(command, okMarkers) {
  console.log(`  📡 ${command}\n`);
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      cwd: ROOT,
      env: cliEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (output.trim()) console.log(output);
  } catch (error) {
    const streams = `${error.stderr?.toString() || ''}\n${error.stdout?.toString() || ''}`;
    if (okMarkers.some((marker) => streams.includes(marker))) {
      if (streams.trim()) console.log(streams.trim());
      return;
    }
    throw error;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
try {
  console.log('\n🚀 SimplyCMS — застосування міграцій\n');

  if (!checkPrerequisites()) process.exit(1);

  console.log('🔗 Підключення до проекту...\n');
  runTolerant(`supabase link --project-ref ${PROJECT_ID}`, ['already linked', 'Finished']);

  console.log('🔄 Застосування міграцій...\n');
  runTolerant('supabase db push --linked', ['Applied', 'up to date']);

  // 🔴 Ланцюжок spec §9: після успішного push типи мусять бути свіжими.
  console.log('🧬 Регенерація типів...\n');
  execSync('pnpm db:generate-types', { cwd: ROOT, env: cliEnv(), stdio: 'inherit' });

  console.log('\n✅ Міграції застосовано, типи оновлено!\n');
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Помилка: ${msg}`);

  if (msg.includes('authentication') || msg.includes('token'))
    console.log('💡 Перевір SUPABASE_ACCESS_TOKEN — можливо він протермінований');
  if (msg.includes('project'))
    console.log('💡 Перевір SUPABASE_PROJECT_ID — він має відповідати вашому проекту');
  if (msg.includes('network') || msg.includes('ECONNREFUSED'))
    console.log('💡 Перевір підключення до інтернету');
  if (msg.includes('password'))
    console.log('💡 Додай SUPABASE_DB_PASSWORD в .env.local');
  if (msg.includes('already applied') || msg.includes('up to date')) {
    console.log('💡 Всі міграції вже застосовані.');
    process.exit(0);
  }

  process.exit(1);
}
