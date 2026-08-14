// Контекст магазину: пошук кореня, manifest, env. Читання БЕЗ мутації process.env.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const CLI_PACKAGE_JSON = fileURLToPath(
  new URL('../package.json', import.meta.url),
);

/** Версія CLI з власного package.json — реліз усіх пакетів ядра синхронний. */
export function readCliVersion() {
  return JSON.parse(readFileSync(CLI_PACKAGE_JSON, 'utf8')).version;
}

/** package.json магазину. Нечитабельний або битий JSON — гучна помилка. */
export function readStoreManifest(storeRoot) {
  const path = join(storeRoot, 'package.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new Error(`Не вдалося прочитати ${path}`, { cause });
  }
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Битий JSON у ${path} — полагодь файл руками`, { cause });
  }
}

/** Усі `@simplycms/*`-залежності манифеста (dependencies + devDependencies). */
export function coreDependencies(manifest) {
  /** @type {Record<string, string>} */
  const core = {};
  for (const source of [manifest.dependencies, manifest.devDependencies]) {
    for (const [name, range] of Object.entries(source ?? {})) {
      if (name.startsWith('@simplycms/')) core[name] = range;
    }
  }
  return core;
}

/**
 * Корінь магазину: вгору по теках до першого `package.json` із залежностями
 * `@simplycms/*`. Не знайдено — гучна помилка: всі команди CLI мають сенс
 * лише всередині магазину.
 */
export function findStoreRoot(cwd = process.cwd()) {
  let dir = resolve(cwd);
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) {
      const manifest = readStoreManifest(dir);
      if (Object.keys(coreDependencies(manifest)).length > 0) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Корінь магазину не знайдено: від ${resolve(cwd)} і вище немає ` +
          'package.json із залежностями @simplycms/*. Запусти команду ' +
          'всередині магазину SimplyCMS.',
      );
    }
    dir = parent;
  }
}

/**
 * env магазину: `process.env` > `.env.local` > `.env` (контракт спеки §7 —
 * env процесу завжди виграє у файлів). Повертає НОВИЙ merged-обʼєкт,
 * `process.env` не мутується. Відсутність env-файлів — не помилка: вони
 * опційні, джерелом може бути сам env процесу; чи вистачає значень —
 * вирішує перевірка №5 doctor.
 */
export function readStoreEnv(storeRoot, processEnv = process.env) {
  /** @type {Record<string, string>} */
  const merged = {};
  // Від найслабшого джерела до найсильнішого: пізніший запис перекриває.
  for (const file of ['.env', '.env.local']) {
    const path = join(storeRoot, file);
    if (!existsSync(path)) continue;
    Object.assign(merged, parseEnv(readFileSync(path, 'utf8')));
  }
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
