import { isSafeCssValue } from 'simplycms/domain';
import type { DesignTokens, ThemeTokenValues } from './types';

/**
 * Порядок і повний перелік CSS-змінних, які може задати тема.
 * Джерело правди — фактичний набір, який задають теми (`themes/<тема>/tokens.ts`).
 * `font-sans`/`font-heading` (контракт v2.2) — не-кольорові токени за
 * прецедентом `radius`: значення рядком, а не HSL-трійка.
 */
const TOKEN_KEYS: ReadonlyArray<keyof ThemeTokenValues> = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'border',
  'input',
  'ring',
  'radius',
  'font-sans',
  'font-heading',
];

/** Зібрати один CSS-блок `selector { --key: value; … }` */
function renderBlock(selector: string, values: ThemeTokenValues): string {
  const declarations = TOKEN_KEYS.filter((key) =>
    isSafeCssValue(values[key], Infinity),
  ).map((key) => `  --${key}: ${values[key]};`);

  if (declarations.length === 0) return '';

  return `${selector} {\n${declarations.join('\n')}\n}`;
}

/**
 * Перетворити токени теми на CSS-рядок для інлайн-`<style>`.
 *
 * Пише в ІСНУЮЧІ semantic-змінні shadcn — жодних нових `--color-*`. Стиль
 * вставляється без `@layer`, тож перекриває базові значення з `globals.css`
 * (нешарові правила виграють у каскаді в будь-якого шару).
 */
export function applyTokens(tokens: DesignTokens): string {
  const blocks = [renderBlock(':root', tokens)];

  if (tokens.dark) {
    blocks.push(renderBlock('.dark', tokens.dark));
  }

  return blocks.filter(Boolean).join('\n');
}
