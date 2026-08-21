/**
 * Gate D — Tailwind бачить компоненти пакетів.
 *
 * Tailwind v4 автодетектом `node_modules` НЕ сканує, тож магазин мусить явно
 * вказати теки пакетів у `content` (див. `tailwind.config.ts` шаблону).
 * Гейт перевіряє результат: у зібраному CSS є утиліти, які зустрічаються
 * ВИКЛЮЧНО в компонентах ядра й теми з `node_modules`, а не у файлах самого
 * магазину.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Класи-маркери: кожен існує тільки в одному файлі пакета ядра.
 *
 * 🔴 Підпис `from` навмисно НЕ у формі специфікатора (`simplycms · ui/button`,
 * а не `simplycms/ui · button`): `scripts/audit-exports` збирає з коду будь-який
 * рядок у лапках, що починається з `simplycms/`, і прийняв би підпис за
 * реальний імпорт неіснуючого субшляху.
 *
 * 🔴 Перші чотири — ОДИН unscoped-пакет ядра (топологія 5, трек К0): вони
 * доводять глобу `./node_modules/simplycms/dist/**` у `tailwind.config.ts`
 * магазину. Останній маркер — ТЕМИ (Фаза 4, Р8): `md:text-6xl` живе виключно в
 * `HeroBanner` теми solarstore, якої в шаблоні магазину немає — вона
 * приїжджає в скретч кроком `installThemes`. Чого цей маркер НЕ доводить:
 * через яку саме глобу він потрапив у CSS (`themes` copy-in-гілки чи
 * `node_modules` npm-гілки) — обидві гілки в скретчі присутні
 * одночасно. Розрізнення джерела закриває окремий доказ глобів —
 * `tests/theme-tailwind-globs.test.ts`.
 */
const MARKERS = [
  { cls: 'underline-offset-4', from: 'simplycms · ui/button' },
  { cls: '[&_svg]:size-4', from: 'simplycms · ui/button' },
  { cls: 'aria-selected:opacity-100', from: 'simplycms · ui/calendar' },
  { cls: 'hover:-translate-y-1', from: 'simplycms · catalog-ui/ProductCard' },
  { cls: 'md:text-6xl', from: '@simplycms/theme-solarstore · HeroBanner' },
];

/** @returns {{ ok: boolean; details: string[] }} */
export function gateTailwind(storeDir) {
  const assetsDir = join(storeDir, 'dist/client/assets');
  const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
  // Селектори в CSS екрановані (`.underline-offset-4`, `.\[\&_svg\]\:size-4`),
  // тож знімаємо бекслеші й шукаємо сирі імена класів.
  const css = cssFiles
    .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
    .join('\n')
    .replace(/\\/g, '');

  const details = [`CSS-файлів: ${cssFiles.length}, символів: ${css.length}`];
  let ok = true;

  for (const { cls, from } of MARKERS) {
    const found = css.includes(`.${cls}`);
    if (!found) ok = false;
    details.push(`${found ? 'OK  ' : 'FAIL'} .${cls} (${from})`);
  }

  return { ok, details };
}
