/**
 * Збір сирих даних для audit-deps: манифести пакетів і bare-імпорти з усіх
 * publish-root-ів. Джерело правди для CLI/тесту — `../audit-deps.mjs`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKAGES_DIR = join(ROOT, 'packages');

/**
 * 🔴 Аудит стосується ЛИШЕ scoped-пакетів ядра: у них є subpath-exports, які
 * ці скрипти й звіряють. Unscoped `create-simplycms-store` лежить у тій самій
 * теці, але exports не має — його свідомо не аудитимо (CLAUDE.md).
 */
export const CORE_SCOPE = '@simplycms/';

// Теки, що потрапляють у tarball і виконуються в рантаймі споживача.
// Route-пакети везуть `routes/` сирцями — тому це теж publish-root.
const PUBLISH_ROOTS = ['src', 'routes'];

const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

// Тести не виконуються у споживача (і `vitest`/`@testing-library` — devDeps
// кореня), тож їхні імпорти не формують вимог до manifest-а пакета.
const TEST_RE = /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/;

/**
 * @typedef {{
 *   name: string;
 *   dir: string;
 *   packageJsonPath: string;
 *   declared: Set<string>;
 *   dependencies: Record<string, string>;
 *   peerDependencies: Record<string, string>;
 * }} PackageInfo
 */

/** Мапа `name → PackageInfo` з усіх `packages/*\/package.json`. */
export function collectPackages() {
  /** @type {Map<string, PackageInfo>} */
  const byName = new Map();

  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = join(PACKAGES_DIR, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const json = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (typeof json.name !== 'string') continue;
    if (!json.name.startsWith(CORE_SCOPE)) continue;

    const dependencies = json.dependencies ?? {};
    const peerDependencies = json.peerDependencies ?? {};
    byName.set(json.name, {
      name: json.name,
      dir: entry.name,
      packageJsonPath,
      declared: new Set([
        ...Object.keys(dependencies),
        ...Object.keys(peerDependencies),
        ...Object.keys(json.optionalDependencies ?? {}),
      ]),
      dependencies,
      peerDependencies,
    });
  }

  return byName;
}

/** Версії зовнішніх пакетів із кореневого manifest-а (deps ∪ devDeps). */
export function collectRootVersions() {
  const json = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  return { ...(json.devDependencies ?? {}), ...(json.dependencies ?? {}) };
}

/** Рекурсивно обходить теку, віддаючи абсолютні шляхи code-файлів. */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    const dot = entry.name.lastIndexOf('.');
    if (dot === -1 || !CODE_EXT.has(entry.name.slice(dot))) continue;
    yield full;
  }
}

/**
 * Усі специфікатори імпорту з publish-root-ів пакета.
 * Витяг — через `ts.preProcessFile` (сканер TypeScript): покриває
 * `import`/`export … from`, side-effect-`import`, `import type`, динамічний
 * `import()` і `require()`, і при цьому НЕ бачить коментарів та рядкових
 * літералів (регекс на цьому б помилявся).
 * @param {PackageInfo} info
 * @returns {Map<string, string[]>} специфікатор → файли (repo-relative)
 */
export function collectImports(info) {
  /** @type {Map<string, string[]>} */
  const bySpecifier = new Map();
  const pkgDir = join(PACKAGES_DIR, info.dir);

  for (const root of PUBLISH_ROOTS) {
    const rootDir = join(pkgDir, root);
    if (!existsSync(rootDir)) continue;

    for (const file of walk(rootDir)) {
      const rel = relative(ROOT, file);
      if (TEST_RE.test(rel)) continue;

      const text = readFileSync(file, 'utf8');
      for (const ref of ts.preProcessFile(text, true, true).importedFiles) {
        const list = bySpecifier.get(ref.fileName);
        if (list) {
          if (!list.includes(rel)) list.push(rel);
        } else {
          bySpecifier.set(ref.fileName, [rel]);
        }
      }
    }
  }

  return bySpecifier;
}
