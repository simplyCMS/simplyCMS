#!/usr/bin/env node

/**
 * Синхронізація генерованої частини шаблону `create-simplycms-store`.
 *
 * Шаблон магазину — джерело правди скаффолдера, але частина його файлів
 * буквально дублює монорепо (host-каркас, міграції, дефолтна тема,
 * референс-плагін). Тримати їх форком — гарантований дрейф після першої ж
 * правки, тож вони СИНКУЮТЬСЯ звідси, а `tests/create-store-template-parity.test.ts`
 * червоніє, щойно копія розійдеться з джерелом (модель `pilot-seed`).
 *
 * Статичні файли шаблону (`package.json.tpl`, `vite.config.ts`, `routes.ts`,
 * `README.md`, `supabase/config.toml` тощо) скрипт НЕ чіпає — їхнє джерело
 * правди сам шаблон.
 *
 * Використання: node scripts/sync-create-store-template.mjs
 */

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');

export const TEMPLATE_DIR = 'packages/create-simplycms-store/template';

/** Host-файли: байт-ідентичні кореню монорепо (та сама 11-ка, що в пілоті). */
export const SYNCED_FILES = [
  'server.mjs',
  'server-runtime.mjs',
  'src/styles/globals.css',
  'src/routes/__root.tsx',
  'src/start.ts',
  'src/client.tsx',
  'src/router.tsx',
  'src/server.ts',
  'src/server/engine.ts',
  'src/engine-provider.tsx',
  'src/theme-registry.ts',
];

/** Теки: байт-ідентичні монорепо (snapshot на момент релізу). */
export const SYNCED_DIRS = [
  { from: 'supabase/migrations', to: 'supabase/migrations' },
  { from: 'themes/default', to: 'themes/default' },
  { from: 'plugins/hello-world', to: 'plugins/hello-world' },
];

/**
 * Перезаписати синковану частину шаблону вмістом монорепо.
 *
 * @param {string} root Корінь репозиторію (за замовчуванням — цей репозиторій).
 */
export function syncTemplate(root = REPO_ROOT) {
  for (const file of SYNCED_FILES) {
    const target = join(root, TEMPLATE_DIR, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  for (const { from, to } of SYNCED_DIRS) {
    const target = join(root, TEMPLATE_DIR, to);
    rmSync(target, { recursive: true, force: true });
    cpSync(join(root, from), target, { recursive: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncTemplate();
  console.log('[template:sync] шаблон синхронізовано з монорепо.');
}
