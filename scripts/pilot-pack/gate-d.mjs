/**
 * Gate D — Tailwind бачить компоненти пакетів.
 *
 * Tailwind v4 автодетектом `node_modules` НЕ сканує, тож магазин мусить явно
 * вказати теки пакетів у `content` (див. `tailwind.config.ts` шаблону).
 * Гейт перевіряє результат: у зібраному CSS є утиліти, які зустрічаються
 * ВИКЛЮЧНО в компонентах `@simplycms/*`, а не в файлах самого магазину.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Класи-маркери: кожен існує тільки в одному файлі пакета ядра. */
const MARKERS = [
  { cls: 'underline-offset-4', from: '@simplycms/ui · button' },
  { cls: '[&_svg]:size-4', from: '@simplycms/ui · button' },
  { cls: 'aria-selected:opacity-100', from: '@simplycms/ui · calendar' },
  { cls: 'hover:-translate-y-1', from: '@simplycms/catalog-ui · ProductCard' },
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
