#!/usr/bin/env node

/**
 * Синхронізація генерованої частини шаблону `create-simplycms-store`
 * і канонічних артефактів ядра для `@simplycms/cli` (спека CLI v1, §5).
 *
 * Шаблон магазину — джерело правди скаффолдера, але частина його файлів
 * буквально дублює монорепо (host-каркас, міграції, дефолтна тема,
 * референс-плагін). Тримати їх форком — гарантований дрейф після першої ж
 * правки, тож вони СИНКУЮТЬСЯ звідси, а `tests/create-store-template-parity.test.ts`
 * червоніє, щойно копія розійдеться з джерелом (модель `pilot-seed`).
 *
 * Дві додаткові цілі того самого механізму: `SYNCED_FILES` → `packages/cli/host/`
 * (канон для `simplycms update`, зі збереженням відносних шляхів) і
 * `supabase/migrations/` → `packages/schema/migrations/` (джерело для
 * `simplycms db:diff` — tarball @simplycms/schema везе міграції ядра).
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

/** Канон host-файлів пакета CLI — тека сама собі маніфест для `simplycms update`. */
export const CLI_HOST_DIR = 'packages/cli/host';

/** Міграції ядра в tarball @simplycms/schema — джерело `simplycms db:diff`. */
export const SCHEMA_MIGRATIONS_DIR = 'packages/schema/migrations';

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
  // Тулінг редизайну за референсом їде в магазин цілком: скрипти інспекції й
  // мапінгу — як є, а скіл — у `.claude/skills/` РЕАЛЬНОЮ копією (у монорепо
  // там симлінк на `.agents/`, але `npm pack`/`cpSync` симлінки не переносять
  // надійно, тож у шаблоні лежить файл).
  { from: 'scripts/design-import', to: 'scripts/design-import' },
  {
    from: '.agents/skills/redesign-from-reference',
    to: '.claude/skills/redesign-from-reference',
  },
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
  // Канон host/ пакета CLI: та сама множина SYNCED_FILES зі збереженням
  // відносних шляхів. Теку пересоздаємо цілком — застарілий чи зайвий файл
  // (включно з .gitkeep) не переживає синк.
  const hostRoot = join(root, CLI_HOST_DIR);
  rmSync(hostRoot, { recursive: true, force: true });
  for (const file of SYNCED_FILES) {
    const target = join(hostRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  // Міграції ядра для tarball @simplycms/schema — байт-копія supabase/migrations.
  const migrationsTarget = join(root, SCHEMA_MIGRATIONS_DIR);
  rmSync(migrationsTarget, { recursive: true, force: true });
  cpSync(join(root, 'supabase/migrations'), migrationsTarget, {
    recursive: true,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncTemplate();
  console.log(
    '[template:sync] шаблон, канон host/ CLI і міграції schema синхронізовано з монорепо.',
  );
}
