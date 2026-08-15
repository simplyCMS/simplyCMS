import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';

/**
 * Маніфести референс-пакетів тримають версію рядком-ЛІТЕРАЛОМ у сирцях —
 * `definePlugin({ version: '…' })` і `ThemeManifest.version`. Саме ця версія
 * їде в рядок таблиці (`plugins`/`themes`), тобто розсинхрон із реєстровою
 * версією пакета видно вже в адмінці магазину.
 *
 * `bumpTo` переписує лише `package.json`, тому без цього кроку перший же
 * `pnpm release X.Y.Z` падав би на власних гейтах — parity-тести
 * (`plugin-manifest-parity`, `theme-manifest-parity`) червоніли б одразу
 * після бампа (знахідка рев'ю плану Фази 4, Р13).
 *
 * Пари «префікс теки → файл маніфесту». Список закритий свідомо: нова
 * конвенція референс-пакета мусить прийти сюди явно, а не мовчки лишитися
 * поза бампом.
 */
const MANIFEST_SOURCES = [
  { prefix: 'simplycms-plugin-', file: join('src', 'index.ts') },
  { prefix: 'simplycms-theme-', file: join('src', 'manifest.ts') },
];

/**
 * Строгий патерн літерала — той самий клас, що `CORE_VERSION_RE`: збіг або
 * точний, або гучна помилка. Вільніший regex мовчки зачепив би `engines`
 * чи версію в коментарі.
 */
const MANIFEST_VERSION_RE = /^(\s*)version: '(\d+\.\d+\.\d+)',$/m;

/**
 * Файли маніфестів референс-пакетів, знайдені на диску.
 * @returns {string[]} шляхи відносно кореня репо
 */
export function manifestVersionFiles() {
  const files = [];
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = MANIFEST_SOURCES.find(({ prefix }) =>
      entry.name.startsWith(prefix),
    );
    if (!source) continue;
    const path = join(PACKAGES_DIR, entry.name, source.file);
    if (!existsSync(path)) {
      throw new Error(
        `Референс-пакет ${entry.name} без файлу маніфесту ${source.file} — ` +
          `або поверни файл, або онови MANIFEST_SOURCES у ` +
          `scripts/release/manifest-version.mjs`,
      );
    }
    files.push(path);
  }
  return files.sort();
}

/**
 * Прочитати єдиний version-літерал маніфеста. Строгість тут і є перевіркою
 * формату: 0 або 2+ збіги — гучна помилка, а не тихий пропуск.
 * @param {string} path
 * @returns {{ source: string; indent: string; current: string }}
 */
function readManifestVersion(path) {
  const source = readFileSync(path, 'utf8');
  const matches = source.match(new RegExp(MANIFEST_VERSION_RE, 'gm')) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `У ${path} знайдено ${matches.length} version-літералів маніфесту ` +
        `(очікувався рівно один вигляду "  version: 'X.Y.Z',"). Формат ` +
        `змінився — онови MANIFEST_VERSION_RE у ` +
        `scripts/release/manifest-version.mjs`,
    );
  }
  const [, indent, current] = MANIFEST_VERSION_RE.exec(source);
  return { source, indent, current };
}

/**
 * ЧИСТА перевірка розсинхрону: файли, чий version-літерал ≠ `version`.
 * Нічого не пише — саме її кличуть гарди й тести. Письменник у ролі чекера
 * мовчки перезаписував би трекнутий сирець (тиха ревертація правки
 * розробника, невідтворювана на другому прогоні) — знахідка рев'ю Фази 4.
 * @param {string} version
 * @returns {string[]} шляхи файлів із розбіжним літералом
 */
export function manifestVersionDrift(version) {
  return manifestVersionFiles().filter(
    (path) => readManifestVersion(path).current !== version,
  );
}

/**
 * Переписати version-літерали маніфестів референс-пакетів.
 * @param {string} version
 * @returns {string[]} файли, які реально змінилися
 */
export function bumpManifestVersions(version) {
  const changed = [];
  for (const path of manifestVersionDrift(version)) {
    const { source, indent } = readManifestVersion(path);
    writeFileSync(
      path,
      source.replace(MANIFEST_VERSION_RE, `${indent}version: '${version}',`),
    );
    changed.push(path);
  }
  return changed;
}
