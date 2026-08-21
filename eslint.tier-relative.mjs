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
//
// 🔴 Форм на ту саму ціль БІЛЬШЕ, ніж одна канонічна (знахідка ревʼю К0,
// коло 2). З `src/cart-ui` до `src/admin` ведуть і `../admin` (через теку
// `src`), і `../../src/admin` (через корінь пакета) — обидві резолвляться,
// але для правила це різні рядки. Тому форми будуються обходом УСІХ предків
// зони до кореня пакета, а не однією найкоротшою.
//
// 🔴 Межа: поза скоупом лишаються неканонічні написання того самого шляху
// (`./../admin`, `..//admin`) і динамічний `import()` — обидва резолвляться,
// але жодного такого написання в репо немає, а глушити їх переліком означало б
// ганятись за нескінченною множиною. Реальний шлях у дірку закриває той
// факт, що всі 900+ крос-тірних імпортів ядра — bare-специфікатори.

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

/** Корінь пакета-флагмана — стеля підйому: вище вже вихід із пакета. */
const PACKAGE_ROOT = join('packages', 'simplycms');

/** Кількість сегментів теки `dir` усередині пакета. */
const segmentsInPackage = (dir) =>
  relative(join(REPO, PACKAGE_ROOT), join(REPO, dir)).split(sep).length;

/**
 * Відносні специфікатори з теки `zoneDir` у теку `targetDir`.
 *
 * Файл зони лежить на глибині `nested` (0 — просто в теці зони), а
 * `'../'.repeat(nested + k)` із нього сідає на предка зони за `k` рівнів
 * вище. Звідти лишок шляху — `relative(предок, targetDir)`. Перебираємо
 * обидва виміри: глибину файлу і предка (до кореня пакета) — саме так у
 * набір потрапляє і `../admin`, і `../../src/admin`.
 * @param {string} zoneDir
 * @param {string} targetDir
 * @returns {string[]}
 */
export function relativeForms(zoneDir, targetDir) {
  const forms = new Set();
  const depth = maxNestingDepth(zoneDir);
  const ceiling = segmentsInPackage(zoneDir);

  for (let nested = 0; nested <= depth; nested += 1) {
    for (let up = 1; up <= ceiling; up += 1) {
      const ancestor = join(REPO, zoneDir, ...Array(up).fill('..'));
      const tail = relative(ancestor, join(REPO, targetDir))
        .split(sep)
        .join('/');
      forms.add('../'.repeat(nested + up) + tail);
    }
  }
  return [...forms];
}
