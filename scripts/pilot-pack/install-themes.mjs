/**
 * Gate THEME-контур пілота (Фаза 4, Р8): обидві гілки установки теми зі
 * спеки §17.4 — прожиті в скретчі тими самими командами, що набирає
 * користувач.
 *
 * 🔴 Чому не оверлей і не фікстура. Оверлейний `tests/pilot/store-template/
 * package.json` чіпати не можна: `tests/create-store-template-parity.test.ts`
 * вимагає рівності МНОЖИН ключів deps шаблону й оверлею, а шаблон другої теми
 * не отримує — свіжий магазин має лише `default`, друга тема це рішення
 * КОРИСТУВАЧА. Тому тема приходить у скретч тим самим шляхом, що й у
 * користувача: через `simplycms add`.
 *
 * 🔴 Місце кроків у конвеєрі — між `pnpm install` і провенансом
 * (`prepare-store.mjs`). Раніше не можна: `pnpm exec simplycms` вимагає
 * вже встановленого бінарника CLI (він у devDeps шаблону). Пізніше не можна:
 * саме провенанс мусить побачити tarball теми в lockfile — інакше не було б
 * доказу, що тема приїхала з локального пакування, а не з реєстру.
 *
 * 🔴 Резолв у ЛОКАЛЬНИЙ tarball забезпечує `writeOverrides`: він пише
 * `overrides:` для ВСІХ спакованих імен, включно з темою, тож `pnpm add` без
 * версії бере файл, а не реєстр (перевірено: у package.json скретча лягає
 * `file:` — саме те, що потім читає провенанс).
 */

import { execFileSync } from 'node:child_process';

/** Референс-тема ядра — єдиний пакет теми, який пілот пакує сам. */
const THEME_PKG = '@simplycms/theme-solarstore';

/** Ключ copy-in-гілки. Свідомо НЕ `solarstore`: обидві гілки живуть поруч. */
const COPY_KEY = 'solarcopy';

/** `simplycms` зі скретча — той самий бінарник, що отримує користувач. */
function cli(storeDir, args) {
  execFileSync('pnpm', ['exec', 'simplycms', ...args], {
    cwd: storeDir,
    stdio: 'inherit',
  });
}

/**
 * Обидві гілки §17.4 підряд у ОДНОМУ магазині.
 *
 * Порядок значущий: copy-in знімає пакет за собою (`pnpm remove`), тож
 * npm-гілка після нього ставить його наново — і в lockfile лишається саме
 * npm-форма, яку далі перевіряє провенанс. Зворотний порядок дав би магазин
 * БЕЗ пакета теми, і провенанс не мав би що доводити.
 *
 * @param {string} storeDir тека скретч-магазину
 */
export function installThemes(storeDir) {
  cli(storeDir, ['add', THEME_PKG, '--theme', '--copy', '--name', COPY_KEY]);
  cli(storeDir, ['add', THEME_PKG, '--theme']);
}
