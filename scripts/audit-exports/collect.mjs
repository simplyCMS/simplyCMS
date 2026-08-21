/**
 * Збір сирих даних для audit-exports: мапа пакетів і специфікатори з коду.
 * Джерело правди для CLI/тесту — `../audit-exports.mjs` (runAudit).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKAGES_DIR = join(ROOT, 'packages');

/**
 * 🔴 Аудит стосується ЛИШЕ пакетів ядра: у них є subpath-exports, які ці
 * скрипти й звіряють. Це scoped-сателіти `@simplycms/*` і unscoped-флагман
 * `simplycms` (К0). Unscoped `create-simplycms-store` лежить у тій самій
 * теці, але exports не має — його свідомо не аудитимо (CLAUDE.md); саме тому
 * імʼя флагмана звіряється ТОЧНО, а не префіксом.
 */
export const CORE_SCOPE = '@simplycms/';
export const CORE_FLAGSHIP = 'simplycms';

/** Чи це пакет ядра (scoped-сателіт або unscoped-флагман). */
export const isCorePackage = (name) =>
  name.startsWith(CORE_SCOPE) || name === CORE_FLAGSHIP;

// Розширення файлів, де реально бувають import/require-специфікатори.
// `*.md` навмисно виключені: доки згадують шляхи в прозі (не імпорти), і
// дали б хибні спрацювання (перевірено вручну на цьому репо).
const CODE_GLOBS = ['*.ts', '*.tsx', '*.mjs', '*.cjs', '*.js'];

// Згенеровані файли — не джерело правди про реальне вживання; власний
// каталог скрипта може містити приклади специфікаторів у коментарях.
const EXCLUDE_PATHSPECS = [
  ':!**/routeTree.gen.ts',
  ':!supabase/types.ts',
  ':!scripts/audit-exports/**',
  ':!scripts/audit-exports.mjs',
  // Межа довіри плагінів (Фаза 3): ban-глоби виду 'simplycms/supabase/*' у
  // eslint-зоні та синтетичні порушення в її негативному контролі — це
  // специфікатори-ЗАБОРОНИ і фікстури, а не реальні імпорти.
  ':!eslint.config.mjs',
  ':!tests/plugin-trust-boundary.test.ts',
  // Те саме для тір-зон напрямку шарів (ПК3, К0): таблиця зон складає
  // ban-глоби `simplycms/<тека>`, а негативний контроль годує ESLint
  // синтетичними порушеннями (включно з `simplycms/…` у прикладі команди в
  // докблоці). Реальних імпортів там немає.
  ':!eslint.tier-zones.mjs',
  ':!tests/tier-boundary.test.ts',
  // Таблиця зон і lint-хелпер живуть у теці поруч — виняток мусить покривати
  // її ЦІЛКОМ, інакше кожен винос фікстур у новий файл мовчки повертає їх у
  // скан (спіймано рев'ю К0, коло 2).
  ':!tests/tier-boundary/**',
];

/**
 * @typedef {{
 *   name: string;
 *   dir: string;
 *   packageJsonPath: string;
 *   exportsKeys: string[];
 *   publishExportsKeys: string[] | null;
 * }} PackageInfo
 */

/** Збирає мапу `name → PackageInfo` з усіх `packages/*\/package.json`. */
export function collectPackages() {
  /** @type {Map<string, PackageInfo>} */
  const byName = new Map();

  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(PACKAGES_DIR, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const json = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (typeof json.name !== 'string') continue;
    if (!isCorePackage(json.name)) continue;

    byName.set(json.name, {
      name: json.name,
      dir: entry.name,
      packageJsonPath,
      exportsKeys: Object.keys(json.exports ?? {}),
      publishExportsKeys: json.publishConfig?.exports
        ? Object.keys(json.publishConfig.exports)
        : null,
    });
  }

  return byName;
}

/**
 * Збирає всі унікальні субшлях-специфікатори ядра з коду —
 * `@simplycms/<pkg>/<subpath>` (сателіти) і `simplycms/<subpath>` (флагман).
 * Квото-обмежений патерн (специфікатор цілком у лапках) відсікає шум типу
 * коментарів на кшталт "перенесено в simplycms/domain/discounts." — крапка
 * речення не потрапляє в лапки й не проходить регекс. Він же розводить дві
 * гілки: `'@simplycms/x'` починається з `@`, тож під гілку флагмана не
 * підпадає, а `simplycms-theme-*` — не має слеша одразу після імені.
 */
export function collectSpecifiers() {
  const pattern = '[\'"](@simplycms/[a-zA-Z0-9_-]+|simplycms)/[^\'"]+[\'"]';
  // `--untracked`: сусідній audit-deps обходить ФС і бачить усе, тож без цього
  // прапорця новий (ще не доданий у git) файл проходив би повз гейт exports.
  // node_modules і артефакти збірки й далі відсікає `.gitignore`.
  const args = [
    'grep',
    '--untracked',
    '-ohE',
    pattern,
    '--',
    ...CODE_GLOBS,
    ...EXCLUDE_PATHSPECS,
  ];

  let raw;
  try {
    raw = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    // git grep повертає exit 1, якщо збігів немає взагалі — це не помилка.
    if (err.status === 1) {
      raw = String(err.stdout ?? '');
    } else {
      throw err;
    }
  }

  const specifiers = new Set();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Знімаємо обрамлюючі лапки.
    specifiers.add(trimmed.slice(1, -1));
  }
  return [...specifiers].sort();
}
