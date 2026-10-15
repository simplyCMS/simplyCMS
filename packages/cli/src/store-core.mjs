// Імпорт модулів ЯДРА й залежностей З МАГАЗИНУ, а не з місця, де лежить сам
// CLI: команди, що ходять у БД (`db:apply`, `doctor --online`) і гейт тем,
// мусять працювати з тією версією ядра, яку магазин справді встановив.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** `@scope/name/sub` → `{ name: '@scope/name', subpath: './sub' }`. */
function splitSpec(spec) {
  const parts = spec.split('/');
  const nameLength = spec.startsWith('@') ? 2 : 1;
  const name = parts.slice(0, nameLength).join('/');
  const rest = parts.slice(nameLength).join('/');
  return { name, subpath: rest ? `./${rest}` : '.' };
}

/** Ціль запису `exports` для ESM-імпорту (`import` > `default`), вкладені умови теж. */
function importTarget(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  for (const key of ['import', 'default']) {
    const found = importTarget(entry[key]);
    if (found) return found;
  }
  return null;
}

/**
 * Резолв за умовою `import`. 🔴 `require.resolve` її не знає: субшляхи
 * серверного ядра (`simplycms/migrate`) в опублікованому пакеті мають лише
 * `types` та `import`, тож CommonJS-резолв падає `ERR_PACKAGE_PATH_NOT_EXPORTED`.
 * Межі фолбеку: лише ТОЧНИЙ ключ `exports[subpath]` (без патернів `*`), без
 * рядкового `exports` і без умови `node`.
 */
function resolveImportCondition(storeRoot, spec) {
  const { name, subpath } = splitSpec(spec);
  for (let dir = resolve(storeRoot); ; dir = dirname(dir)) {
    const manifestPath = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const target = importTarget(manifest.exports?.[subpath]);
      if (!target)
        throw new Error(`Пакет ${name} не експортує ${subpath} для import.`);
      return join(dirname(manifestPath), target);
    }
    if (dirname(dir) === dir)
      throw new Error(
        `Пакет ${name} не встановлено в ${storeRoot} (pnpm install).`,
      );
  }
}

/**
 * Імпорт пакета З МАГАЗИНУ. Під pnpm `@simplycms/cli` живе в ізольованому
 * сторі, і звичайний `import('vite')` звідти не резолвиться взагалі — резолв
 * мусить іти від `package.json` магазину.
 * @param {string} storeRoot
 * @param {string} spec
 */
export async function importFromStore(storeRoot, spec) {
  const require = createRequire(join(storeRoot, 'package.json'));
  let file;
  try {
    file = require.resolve(spec);
  } catch (error) {
    if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    file = resolveImportCondition(storeRoot, spec);
  }
  return import(pathToFileURL(file).href);
}
