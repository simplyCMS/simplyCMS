import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'tsdown';
// Self-reference: конфіг лежить у пакеті, Node резолвить `simplycms/*` через
// власний `exports` (dev-мапа → src), tsc — через paths кореневого tsconfig.
import { isServerOnlySubpath } from 'simplycms/contracts/server-only';

// Збірка ядра — ДВІ групи замість профілів (трек T, ред. 3).
//
// 🔴 Список entry НЕ пишеться руками: він виводиться з dev-`exports`
// package.json (ключ → джерело; у dist файл лягає за шляхом ДЖЕРЕЛА), тож
// `dist/` дзеркалить exports ЗА ПОБУДОВОЮ. Wildcard-ціль `./src/ui/*.tsx`
// розгортається глобом `src/ui/**/*.tsx` — рівно стільки, скільки обіцяє
// exports-wildcard (він матчить і вкладені шляхи; до ред. 3 сім вкладених
// `.tsx` під `storefront-routes/pages/*` були обіцяні, але не зібрані).
// Цілі поза `./src/` (`routes/*` — сирі TSX роутів) пропускаються.
//
// 🔴 Розділ на групи — це і є межа довіри в артефакті: модулі різних збірок
// Rolldown не може покласти в один чанк, тож серверний код ніколи не
// зʼявиться в чанку, досяжному з клієнтського entry. Усередині серверної
// групи спільні чанки дозволені й бажані (34 майбутні impl адмінки ділять
// `resource.ts` одним чанком, а не 34 копіями). Хто де — вирішує єдина
// декларація `contracts/server-only`; гейт — `tests/dist-server-boundary`.
// Клієнтська група включає serverFn-модулі (`themes/server`, `plugins/server`,
// `plugin-sdk/server`, стаби admin-server): їх клієнт імпортує легально, а
// компілятор Start робить із них RPC-стаби.
//
// 🔴 `deps.neverBundle` обовʼязковий: інтра-пакетні імпорти — self-reference
// субшляхи (`simplycms/contracts` усередині цього ж пакета), бандлер
// авто-зовнішнить лише dependencies/peerDependencies, а пакет не може
// залежати сам від себе. Без правила граф вбудувався б у кожен entry й
// задублював stateful-модулі (реєстри, пул) МОВЧКИ.

// 🔴 Усе — від теки пакета, не від cwd: конфіг імпортує і `tsdown` (cwd =
// пакет), і `tests/dts-toolchain.test.ts` з кореневого vitest (cwd = корінь,
// де `package.json` без `exports`, а глоби `src/**` порожні). Без цього
// імпорт із кореня падав би на `Object.entries(undefined)` (знахідка аудиту).
const PACKAGE_ROOT = import.meta.dirname;
const pkg = JSON.parse(
  readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'),
) as { exports: Record<string, string> };

/** `./src/schema/schema.ts` → `schema/schema`: шлях у dist = шлях джерела. */
const outOf = (source: string): string =>
  source.replace(/^\.?\/?src\//, '').replace(/\.tsx?$/, '');

// 🔴 Шлях у dist береться з ДЖЕРЕЛА, а не з ключа exports: `dist/` дзеркалить
// розкладку `src/`, а ключ лише вказує на файл (`./schema` →
// `schema/schema.js`, `./contracts` → `contracts/index.js`,
// `./core/providers` → `core/providers/CMSProvider.js`). Виведення з ключа
// дало б 37 розбіжностей із `publishConfig.exports` (знахідка аудиту ред. 3).
const entries = Object.entries(pkg.exports)
  .filter(([, target]) => target.startsWith('./src/'))
  .flatMap(([key, target]): Array<[string, string]> => {
    if (!key.includes('*'))
      return [[outOf(target), resolve(PACKAGE_ROOT, target)]];
    const [dir, ext] = target.slice(2).split('*');
    const files = globSync(`${dir}**/*${ext || '.{ts,tsx}'}`, {
      cwd: PACKAGE_ROOT,
    })
      .map((file) => file.split('\\').join('/'))
      .filter((file) => !file.includes('__tests__'))
      .sort();
    // Wildcard без збігів — одрук у exports або перенесена тека: падати
    // гучно, а не мовчки лишити пакет без частини entry.
    if (files.length === 0) throw new Error(`tsdown.config: ${key} без збігів`);
    return files.map((file) => [outOf(file), resolve(PACKAGE_ROOT, file)]);
  });

const group = (server: boolean): Record<string, string> =>
  Object.fromEntries(
    entries.filter(([out]) => isServerOnlySubpath(out) === server),
  );

const base = {
  format: ['esm'],
  // Той самий platform, що був дефолтом tsup: builtins Node (`node:crypto` у
  // лоадерах) зовнішні без попереджень; у браузер код їде лише через
  // бандлер магазину. За `neutral` Rolldown дає UNRESOLVED_IMPORT на кожен.
  platform: 'node',
  // При platform node дефолт `fixedExtension` дав би `.mjs` повз exports.
  fixedExtension: false,
  // 🔴 dts вимкнено: декларації емітить `tsc -p tsconfig.dts.json` (крок
  // `build`). Виміряно 2026-09-02: dts-плагін бандлера на цьому пакеті
  // вичерпує 3 ГБ heap за 25 с (і за 29 с при concurrency 1), tsc робить те
  // саме за 11 с і 1,1 ГБ. Умова перегляду — `isolatedDeclarations` у
  // tsconfig: тоді декларації емітить oxc без програми TypeScript.
  // Гард — tests/dts-toolchain.test.ts.
  dts: false,
  cwd: PACKAGE_ROOT,
  tsconfig: resolve(PACKAGE_ROOT, 'tsconfig.json'),
  sourcemap: true,
  // 🔴 target esnext: за нижчого таргета бандлер лоуерить `import.meta` у
  // `var import_meta = {}`, і опублікований dist читає `{}.env.VITE_…`.
  // Гард — tests/dist-import-meta.test.ts.
  target: 'esnext',
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
} satisfies UserConfig;

export default defineConfig([
  // Клієнтська група. `clean: true` рівно тут: tsdown чистить outDir один
  // раз для всього масиву, до першого запису; `tsc` дописує .d.ts після.
  { ...base, clean: true, entry: group(false) },
  // Серверна група: db, auth, schema/*, storefront/{loaders,seo},
  // admin-server/impl. Спільні чанки — лише між собою.
  { ...base, entry: group(true) },
]);
