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

/**
 * Чи це пакет ядра — тобто той, що йде в релізному потязі SimplyCMS.
 *
 * 🔴 Дві форми, і обидві обовʼязкові (топологія 5, трек К0): сам фреймворк —
 * UNSCOPED `simplycms`, сателіти (CLI, референс-тема, референс-плагін) —
 * scoped `@simplycms/*`. Імʼя `simplycms` перевіряється ТОЧНО: префіксом воно
 * зачепило б `simplycms-theme-aurora` — сторонню тему з власним циклом релізу.
 * @param {string} name
 */
export const isCorePackage = (name) =>
  name === 'simplycms' || name.startsWith('@simplycms/');

/** Усі залежності ядра в манифесті (dependencies + devDependencies). */
export function coreDependencies(manifest) {
  /** @type {Record<string, string>} */
  const core = {};
  for (const source of [manifest.dependencies, manifest.devDependencies]) {
    for (const [name, range] of Object.entries(source ?? {})) {
      if (isCorePackage(name)) core[name] = range;
    }
  }
  return core;
}

/** Магазинний маркер: `package.json` із залежностями ядра. */
function isStoreRoot(dir) {
  if (!existsSync(join(dir, 'package.json'))) return false;
  return Object.keys(coreDependencies(readStoreManifest(dir))).length > 0;
}

/**
 * Маркер кореня монорепо ядра: обидва файли САМЕ поруч — `pnpm-workspace.yaml`
 * сам по собі є в будь-якому pnpm-монорепо, а `simplycms.config.ts` робить
 * його монорепо SimplyCMS. Залежностей ядра в кореневому манифесті монорепо
 * рівно нуль (пакети живуть у workspace), тож магазинний маркер його не
 * бачить.
 */
function isMonorepoRoot(dir) {
  return (
    existsSync(join(dir, 'pnpm-workspace.yaml')) &&
    existsSync(join(dir, 'simplycms.config.ts'))
  );
}

/** Спільний підйом угору по теках; різниця між двома коренями — один прапорець. */
function findRoot(cwd, allowMonorepo) {
  let dir = resolve(cwd);
  for (;;) {
    if (isStoreRoot(dir)) return dir;
    if (allowMonorepo && isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Корінь магазину не знайдено: від ${resolve(cwd)} і вище немає ` +
          'package.json із залежностями ядра (simplycms / @simplycms/*)' +
          (allowMonorepo
            ? ', ні пари pnpm-workspace.yaml + simplycms.config.ts ' +
              '(корінь монорепо ядра). Запусти команду в магазині SimplyCMS ' +
              'або в корені монорепо.'
            : '. Запусти команду всередині магазину SimplyCMS.'),
      );
    }
    dir = parent;
  }
}

/**
 * Корінь МАГАЗИНУ — для doctor/add/update/db:diff. Корінь монорепо ядра тут
 * коренем НЕ вважається свідомо: `doctor` видав би там дві хибні помилки
 * (`routes.ts` монтує теки шляхами, Tailwind ходить аліасами — обидва
 * коректні за побудовою), а `update --write` копіює `packages/cli/host/` у
 * корінь, тобто напрям істини ІНВЕРТОВАНИЙ відносно `pnpm template:sync` і
 * правка host-файла без наступного sync мовчки відкотилася б.
 */
export function findStoreRoot(cwd = process.cwd()) {
  return findRoot(cwd, false);
}

/**
 * Корінь для СКАФФОЛДУ (`create theme` / `create plugin`, Р9): магазин або
 * корінь монорепо ядра. Скаффолд лише створює нову теку в `themes/`/`plugins/`
 * і дописує рядок у `simplycms.config.ts` — у монорепо це рівно те, що треба
 * авторові теми/плагіна, і нічого наявного не переписує.
 */
export function findScaffoldRoot(cwd = process.cwd()) {
  return findRoot(cwd, true);
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
