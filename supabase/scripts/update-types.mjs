#!/usr/bin/env node

/**
 * Генерація TypeScript типів із Supabase Management API.
 *
 * Використовує SUPABASE_PROJECT_ID та SUPABASE_ACCESS_TOKEN
 * для отримання актуальних типів з будь-якого Supabase проекту
 * (hosted або self-hosted).
 *
 * Використання:
 *   pnpm db:generate-types
 *
 * Змінні оточення (.env.local):
 *   SUPABASE_PROJECT_ID=your-project-ref
 *   SUPABASE_ACCESS_TOKEN=sbp_xxxx
 *
 * Отримати токен: https://app.supabase.com/account/tokens
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// ── Шляхи ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const TYPES_OUTPUT = join(PROJECT_ROOT, 'supabase', 'types.ts');

// ── Завантажити .env.local та .env ──────────────────────────────────────────
config({ path: join(PROJECT_ROOT, '.env.local') });
config({ path: join(PROJECT_ROOT, '.env') });

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// ── Бекап поточного файлу ───────────────────────────────────────────────────
function createBackup() {
  if (!existsSync(TYPES_OUTPUT)) return;

  try {
    const content = readFileSync(TYPES_OUTPUT, 'utf8');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupFile = TYPES_OUTPUT.replace('.ts', `.backup.${ts}.ts`);
    writeFileSync(backupFile, content);
    console.log(`  💾 Бекап: ${backupFile.split(/[\\/]/).pop()}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️  Не вдалося створити бекап: ${msg}`);
  }
}

// ── Перевірка передумов ─────────────────────────────────────────────────────
function checkPrerequisites() {
  console.log('🔍 Перевірка передумов...\n');

  // Supabase CLI
  try {
    const version = execSync('supabase --version', { encoding: 'utf8' })
      .trim()
      .split('\n')[0];
    console.log(`  ✅ Supabase CLI: ${version}`);
  } catch {
    console.error('  ❌ Supabase CLI не знайдено!');
    console.log('  💡 Встанови: https://supabase.com/docs/guides/cli/getting-started');
    return false;
  }

  // PROJECT_ID
  if (!PROJECT_ID) {
    console.error('  ❌ SUPABASE_PROJECT_ID не задано!');
    console.log('  💡 Додай в .env.local:');
    console.log('     SUPABASE_PROJECT_ID=your-project-ref');
    return false;
  }
  console.log(`  ✅ Project ID: ${PROJECT_ID}`);

  // ACCESS_TOKEN
  if (!ACCESS_TOKEN) {
    console.error('  ❌ SUPABASE_ACCESS_TOKEN не задано!');
    console.log('  💡 Додай в .env.local:');
    console.log('     SUPABASE_ACCESS_TOKEN=sbp_xxxx');
    console.log('  💡 Отримай токен: https://app.supabase.com/account/tokens');
    return false;
  }
  console.log('  ✅ Access token: знайдено');

  console.log();
  return true;
}

// ── Генерація типів ─────────────────────────────────────────────────────────
function generateTypes() {
  console.log('🔄 Генерація TypeScript типів...\n');

  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN };
  const command = `supabase gen types typescript --project-id=${PROJECT_ID}`;
  console.log(`  📡 ${command}\n`);

  const typesOutput = execSync(command, {
    encoding: 'utf8',
    env,
    maxBuffer: 1024 * 1024 * 10,
  });

  if (!typesOutput || typesOutput.trim().length < 100) {
    throw new Error('Supabase CLI повернув порожній результат. Перевір project ID та токен.');
  }

  return typesOutput;
}

// ── Запис файлу та статистика ────────────────────────────────────────────────
function writeTypesFile(rawTypes) {
  writeFileSync(TYPES_OUTPUT, rawTypes, 'utf8');

  const timestamp = new Date().toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = rawTypes.split('\n').length;
  const sizeKb = (rawTypes.length / 1024).toFixed(1);
  const tables = (rawTypes.match(/^\s+\w+:\s*\{$/gm) || []).length;
  const types = (rawTypes.match(/export type \w+/g) || []).length;

  console.log('📊 Результат:');
  console.log(`   📝 Рядків: ${lines}`);
  console.log(`   ✨ Розмір: ${sizeKb} KB`);
  console.log(`   🗂️  Таблиць: ${tables}`);
  console.log(`   🎯 Типів: ${types}`);
  console.log(`   📁 Файл: supabase/types.ts`);
  console.log(`   🕐 ${timestamp}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────
try {
  console.log('\n🚀 SimplyCMS — Генерація типів БД\n');

  if (!checkPrerequisites()) {
    process.exit(1);
  }

  const rawTypes = generateTypes();

  // Порівняння з поточним файлом — уникаємо фантомних змін в git
  if (existsSync(TYPES_OUTPUT)) {
    const currentContent = readFileSync(TYPES_OUTPUT, 'utf8');
    if (currentContent === rawTypes) {
      console.log('ℹ️  Типи не змінились — файл залишається без змін.\n');
      process.exit(0);
    }
  }

  createBackup();
  writeTypesFile(rawTypes);

  console.log('✅ Типи успішно оновлено!\n');
  console.log('💡 Усі споживачі отримають оновлені типи через @simplycms/db-types.\n');
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Помилка: ${msg}`);

  if (msg.includes('authentication') || msg.includes('token')) {
    console.log('💡 Перевір SUPABASE_ACCESS_TOKEN — можливо він протермінований');
  }
  if (msg.includes('project')) {
    console.log('💡 Перевір SUPABASE_PROJECT_ID — він має відповідати вашому проекту');
  }
  if (msg.includes('network') || msg.includes('ECONNREFUSED')) {
    console.log('💡 Перевір підключення до інтернету');
  }

  process.exit(1);
}
