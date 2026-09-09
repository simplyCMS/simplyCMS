/**
 * FAQ-контур пілота (ПК7, трек К0): довстановлення `@simplycms/plugin-faq`
 * у скретч-магазин.
 *
 * 🔴 Навіщо окремий крок. З шаблону магазину FAQ знято — це референс-плагін, а
 * не частина стартового магазину. Але монорепо його монтує (`routes.ts`,
 * `physical('', '../../packages/simplycms-plugin-faq/routes')`), тож без
 * довстановлення Gate A побачив би різницю множин route-id і чесно впав; Gate
 * B/E прожили б магазин, у якому контур плагіна взагалі не існує.
 *
 * 🔴 Чому не оверлей `tests/pilot/store-template/package.json`:
 * `tests/create-store-template-parity.test.ts` вимагає рівності МНОЖИН ключів
 * deps шаблону й оверлею. Той самий аргумент, що для тем — див.
 * `install-themes.mjs`.
 *
 * 🔴 Місце в конвеєрі — між `pnpm install` і провенансом (`prepare-store.mjs`). Раніше
 * не можна (`pnpm exec simplycms` потребує вже встановленого CLI), пізніше не
 * можна (провенанс мусить побачити tarball плагіна в lockfile, а `vite build`
 * — уже змонтовані роути).
 *
 * Пакет і запис у конфізі ставить сам CLI — тим самим `simplycms add`, що й
 * користувач. Руками лишається ЛИШЕ монтування роут-теки: автоматичну вставку
 * в `routes.ts` спека CLI v1 §9 свідомо відклала, тож тут відтворено рівно те,
 * що робить власник магазину за інструкцією.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Референс-плагін ядра — єдиний плагін-пакет, який пілот пакує сам. */
const FAQ_PKG = '@simplycms/plugin-faq';

/**
 * Хелпер шляху до роут-теки ПАКЕТА-ПЛАГІНА.
 *
 * Шаблонний `coreRoutes` прибитий до підтек одного флагмана, а плагін —
 * окремий пакет, тож у магазин дописується парний хелпер. `realpathSync` той
 * самий і з тієї ж причини: без нього роути плагіна мовчки втрачають
 * code-splitting (розгорнутий коментар — у `template/routes.ts`).
 */
const PLUGIN_ROUTES_HELPER = `
/** Роут-тека пакета-плагіна — той самий realpathSync, що для ядра. */
const pluginRoutes = (name: string) =>
  relative(
    ROUTES_DIR,
    realpathSync(resolve(STORE_ROOT, 'node_modules', name, 'routes')),
  );
`;

/** Якір монтування — рядок кастомних роутів магазину, він завжди останній. */
const MOUNT_ANCHOR = "  physical('', 'my'),";

/** Якір вставки хелпера — оголошення віртуальної конфігурації роутів. */
const HELPER_ANCHOR = 'export const routes = rootRoute(';

/** `simplycms` зі скретча — той самий бінарник, що отримує користувач. */
function cli(storeDir, args) {
  execFileSync('pnpm', ['exec', 'simplycms', ...args], {
    cwd: storeDir,
    stdio: 'inherit',
  });
}

/**
 * Змонтувати роут-теку плагіна в `routes.ts` скретча.
 *
 * Обидва якорі — точні рядки шаблону. Відсутній якір валить крок голосно:
 * мовчазний пропуск дав би магазин без роутів плагіна, і Gate A звинуватив би
 * у цьому генератор роутів замість пілота.
 *
 * @param {string} storeDir тека скретч-магазину
 */
function mountRoutes(storeDir) {
  const path = join(storeDir, 'routes.ts');
  const source = readFileSync(path, 'utf8');
  for (const anchor of [HELPER_ANCHOR, MOUNT_ANCHOR]) {
    if (!source.includes(anchor)) {
      throw new Error(
        `FAQ-контур: у routes.ts скретча немає якоря «${anchor}» — ` +
          'шаблон магазину змінився, крок пілота треба оновити.',
      );
    }
  }
  if (source.includes('pluginRoutes')) return;

  writeFileSync(
    path,
    source
      .replace(HELPER_ANCHOR, `${PLUGIN_ROUTES_HELPER}\n${HELPER_ANCHOR}`)
      .replace(
        MOUNT_ANCHOR,
        `  physical('', pluginRoutes('${FAQ_PKG}')),\n${MOUNT_ANCHOR}`,
      ),
    'utf8',
  );
}

/**
 * Довстановити FAQ: пакет + запис у конфізі (CLI) і монтування роутів (руками).
 *
 * @param {string} storeDir тека скретч-магазину
 */
export function installFaq(storeDir) {
  cli(storeDir, ['add', FAQ_PKG, '--plugin']);
  mountRoutes(storeDir);
}
