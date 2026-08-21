// Відносні форми крос-тірного імпорту для тір-зон (ПК3, трек К0).
//
// `no-restricted-imports` матчить РЯДОК специфікатора, а не резолвлений
// модуль: `simplycms/admin` і `../admin` для правила — різні записи. До К0
// відносну форму тримала межа npm-пакета — `packages/ui/src` фізично не
// діставав `packages/admin/src` через `../`. Після злиття тек в один пакет
// вона стала синтаксично короткою й тому ймовірною, а зону обходила б мовчки.
//
// 🔴 Групи правила gitignore-подібні: запис `../admin` покриває і сам
// `../admin`, і все піддерево `../admin/pages/Products`, але НЕ ловить
// `../administration` (перевірено ESLint-пробою) — варіант із `/**` зайвий.
// А от кожен рівень `../` — окремий запис: `../../admin` під `../admin` не
// підпадає, тому форми генеруються по одній на рівень вкладеності.

import { readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(fileURLToPath(import.meta.url));

/** @type {Map<string, number>} */
const depthCache = new Map();

/**
 * Максимальна вкладеність тек із кодом під `dir` (0 — файли лише в корені).
 * Бюджет `../` береться з ФАКТИЧНОГО дерева: ширший дав би мертві патерни,
 * вужчий — дірку для файлу, покладеного глибше.
 * @param {string} dir тека відносно кореня репозиторію
 * @returns {number}
 */
function maxNestingDepth(dir) {
  const cached = depthCache.get(dir);
  if (cached !== undefined) return cached;

  const root = join(REPO, dir);
  let max = 0;
  for (const entry of readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isDirectory() || !/\.tsx?$/.test(entry.name)) continue;
    const rel = relative(root, join(entry.parentPath, entry.name));
    max = Math.max(max, rel.split(sep).length - 1);
  }
  depthCache.set(dir, max);
  return max;
}

/**
 * Відносні специфікатори з теки `zoneDir` у теку `targetDir` — по одному на
 * кожен можливий рівень вкладеності файлу зони.
 * @param {string} zoneDir
 * @param {string} targetDir
 * @returns {string[]}
 */
export function relativeForms(zoneDir, targetDir) {
  const base = relative(join(REPO, zoneDir), join(REPO, targetDir))
    .split(sep)
    .join('/');
  return Array.from(
    { length: maxNestingDepth(zoneDir) + 1 },
    (_, level) => '../'.repeat(level) + base,
  );
}
