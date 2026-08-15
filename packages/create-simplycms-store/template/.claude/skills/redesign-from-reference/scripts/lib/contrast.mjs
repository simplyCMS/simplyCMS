/**
 * WCAG-контраст пар `*`/`*-foreground` (Фаза 1, задача §2.B.3).
 *
 * Скрипт нічого не «виправляє» — лише чесно повідомляє провалені пари;
 * рішення лишається за агентом + користувачем (Р7 плану).
 */
import { contrastRatio, hslToRgb, parseHslTriple } from './color.mjs';

/** WCAG AA поріг контрасту для тексту (задача §2.B.3). */
export const AA_MIN_RATIO = 4.5;

/**
 * Канонічні пари `*`/`*-foreground` контракту тем
 * (`packages/theme-system/src/types.ts`, 23 кольорові ключі). `border`/
 * `input`/`ring` пари не мають — контракт не визначає для них `-foreground`.
 */
export const CONTRAST_PAIRS = [
  ['background', 'foreground'],
  ['card', 'card-foreground'],
  ['popover', 'popover-foreground'],
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['muted', 'muted-foreground'],
  ['accent', 'accent-foreground'],
  ['destructive', 'destructive-foreground'],
  ['success', 'success-foreground'],
  ['warning', 'warning-foreground'],
];

/**
 * Перевірити контраст пар, присутніх у `values` (`ThemeTokenValues`-подібний
 * обʼєкт). Пари з відсутнім чи нерозпізнаним значенням мовчки пропускаються —
 * це не помилка формату, а просто ще не мапований токен.
 *
 * `prefix` дозволяє позначити попередження від `dark`-блоку (напр.
 * `"dark:"`) без дублювання логіки для світлого/темного набору.
 */
export function checkContrastPairs(values, prefix = '') {
  const warnings = [];

  for (const [baseKey, fgKey] of CONTRAST_PAIRS) {
    const baseHsl = parseHslTriple(values?.[baseKey]);
    const fgHsl = parseHslTriple(values?.[fgKey]);
    if (!baseHsl || !fgHsl) continue;

    const ratio = contrastRatio(hslToRgb(baseHsl), hslToRgb(fgHsl));
    if (ratio < AA_MIN_RATIO) {
      warnings.push({
        pair: `${prefix}${baseKey}/${fgKey}`,
        ratio: Math.round(ratio * 100) / 100,
        required: AA_MIN_RATIO,
      });
    }
  }

  return warnings;
}
