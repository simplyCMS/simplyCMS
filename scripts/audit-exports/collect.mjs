/**
 * Збір сирих даних для audit-exports: мапа пакетів і специфікатори з коду.
 * Джерело правди для CLI/тесту — `../audit-exports.mjs` (runAudit).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKAGES_DIR = join(ROOT, 'packages', 'simplycms');

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

/** Збирає мапу `name → PackageInfo` з усіх `packages/simplycms/*\/package.json`. */
export function collectPackages() {
  /** @type {Map<string, PackageInfo>} */
  const byName = new Map();

  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(PACKAGES_DIR, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const json = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (typeof json.name !== 'string') continue;

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
 * Збирає всі унікальні специфікатори `@simplycms/<pkg>/<subpath>` з коду.
 * Квото-обмежений патерн (специфікатор цілком у лапках) відсікає шум типу
 * коментарів на кшталт "перенесено в @simplycms/domain/discounts." — крапка
 * речення не потрапляє в лапки й не проходить регекс.
 */
export function collectSpecifiers() {
  const pattern = '[\'"]@simplycms/[a-zA-Z0-9_-]+/[^\'"]+[\'"]';
  const args = [
    'grep',
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
