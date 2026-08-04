#!/usr/bin/env node
// Оновлення baseline-типів БД пакета @simplycms/supabase.
//
// Джерело — host-генерат `supabase/types.ts` (`pnpm db:generate-types`).
// Ціль — `packages/supabase/src/database.ts`: закомічений снапшот
// типів CORE-схеми, проти якого типізуються всі пакети ядра.
//
// 🔴 Запускати ЛИШЕ на еталонній dev-БД без встановлених плагінів: плагінні
// таблиці в baseline не входять ніколи (їх бачить тільки host-генерат).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'supabase/types.ts');
const TARGET = resolve(ROOT, 'packages/supabase/src/database.ts');
const TARGET_REL = 'packages/supabase/src/database.ts';
const PRETTIERIGNORE = resolve(ROOT, '.prettierignore');

const BANNER = `// ⚠️  ЗГЕНЕРОВАНИЙ ФАЙЛ — не редагувати руками.
//
// Baseline типів CORE-схеми SimplyCMS: снапшот \`supabase/types.ts\`, знятий
// на еталонній dev-БД БЕЗ плагінів. Проти нього типізуються пакети ядра.
// Магазин зі своїми (плагінними) таблицями підставляє власний \`Database\`
// у фабрики клієнтів — див. README пакета, розділ «Generic-місток».
//
// Оновлення: \`pnpm types:baseline\` (після кожної core-міграції).

`;

if (!existsSync(SOURCE)) {
  console.error(
    `❌ Немає джерела: ${SOURCE}. Спершу \`pnpm db:generate-types\`.`,
  );
  process.exit(1);
}

// Гейт: baseline — генерат, prettier його форматувати не повинен.
const ignore = readFileSync(PRETTIERIGNORE, 'utf8');
if (!ignore.split('\n').some((line) => line.trim() === TARGET_REL)) {
  console.error(`❌ У .prettierignore немає рядка \`${TARGET_REL}\`.`);
  process.exit(1);
}

const next = BANNER + readFileSync(SOURCE, 'utf8');

if (existsSync(TARGET) && readFileSync(TARGET, 'utf8') === next) {
  console.log('ℹ️  Baseline не змінився.');
  process.exit(0);
}

writeFileSync(TARGET, next, 'utf8');
console.log(`✅ Baseline оновлено: ${TARGET_REL}`);
