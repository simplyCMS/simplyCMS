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
// каталог скрипта містить приклади імпортів у фікстурах. Фікстури-ЗАБОРОНИ в
// звичайних рядках (ban-глоби eslint-зон, імена правил) винятків не потребують:
// сканер бере специфікатори лише з імпорт-форм. Тут лишились тільки файли, що
// містять СИНТЕТИЧНІ справжні імпорти в рядках-фікстурах негативного контролю.
const EXCLUDE_PATHSPECS = [
  ':!**/routeTree.gen.ts',
  ':!scripts/audit-exports/**',
  ':!scripts/audit-exports.mjs',
  // Межа довіри плагінів (Фаза 3): негативний контроль годує ESLint кодом
  // `import … from 'simplycms/admin-server'` та ін. — це фікстури-порушення.
  ':!tests/plugin-trust-boundary.test.ts',
  // Тір-зони (ПК3, К0): негативний контроль містить синтетичний
  // `import type { X } from 'simplycms/admin'`.
  ':!tests/tier-boundary.test.ts',
  // Негативний контроль самого цього аудиту: фікстури з імпорт-формами
  // (`import 'simplycms/a'`, мертвих К0-імен), якими тест доводить поведінку
  // сканера. Без винятку вони валили б гейт самі на собі.
  ':!tests/audit-exports.test.ts',
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
 * Імпорт-форми, з яких беремо специфікатор: `from '…'` (import/export), побічний
 * `import '…'`, `import('…')`, `require('…')` і `vi.mock('…')`-родина (мок
 * неіснуючого субшляху так само ховає розрив exports). Довільний літерал чи
 * коментар специфікатором не є: інакше кожна згадка `simplycms/…` у ban-глобі,
 * імені правила лінту чи прикладі росила б `EXCLUDE_PATHSPECS`. `\s*` між
 * ключовим словом і лапкою покриває багаторядкові `} from\n'…'`.
 */
const SPECIFIER_RE = new RegExp(
  '(?:\\bfrom|\\bimport|\\brequire|\\bvi\\s*\\.\\s*(?:mock|doMock|unmock|importActual|importMock))' +
    '\\s*\\(?\\s*([\'"])((?:@simplycms/[a-zA-Z0-9_-]+|simplycms)/[^\'"]+)\\1',
  'g',
);

/**
 * Витягає субшлях-специфікатори ядра з тексту одного файлу —
 * `@simplycms/<pkg>/<subpath>` (сателіти) і `simplycms/<subpath>` (флагман).
 * Гілки розведені регексом: `'@simplycms/x'` починається з `@`, тож під гілку
 * флагмана не підпадає, а `simplycms-theme-*` не має слеша одразу після імені.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractSpecifiers(text) {
  return [...text.matchAll(SPECIFIER_RE)].map((m) => m[2]);
}

/** Збирає всі унікальні специфікатори ядра з коду репо (див. `extractSpecifiers`). */
export function collectSpecifiers() {
  // `--untracked`/`--others`: сусідній audit-deps обходить ФС і бачить усе, тож
  // без цього новий (ще не доданий у git) файл проходив би повз гейт exports.
  // node_modules і артефакти збірки й далі відсікає `.gitignore`.
  const raw = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...CODE_GLOBS,
      ...EXCLUDE_PATHSPECS,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const specifiers = new Set();
  for (const file of raw.split('\n')) {
    if (!file) continue;
    // Файл у індексі, але видалений з диска (ще не staged) — не джерело.
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const spec of extractSpecifiers(readFileSync(path, 'utf8'))) {
      specifiers.add(spec);
    }
  }
  return [...specifiers].sort();
}
