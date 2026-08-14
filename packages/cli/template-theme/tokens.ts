import type { DesignTokens } from '@simplycms/themes/types';

/**
 * Токени теми — значення НАЯВНИХ semantic-змінних shadcn (`--primary`,
 * `--background`, `--radius`, …). Нових `--color-*` тема не вводить:
 * `applyTokens` розкладає цей обʼєкт у CSS-змінні, тому власного CSS-файла
 * тема не постачає. Ключі, які тут не задані, лишаються з fallback-палітри
 * (еталон — `themes/default/tokens.ts`).
 */
export const tokens: DesignTokens = {
  background: '0 0% 100%',
  foreground: '222 47% 11%',

  card: '0 0% 100%',
  'card-foreground': '222 47% 11%',

  popover: '0 0% 100%',
  'popover-foreground': '222 47% 11%',

  primary: '221 83% 53%',
  'primary-foreground': '0 0% 100%',

  secondary: '210 40% 96%',
  'secondary-foreground': '222 47% 11%',

  muted: '210 40% 96%',
  'muted-foreground': '215 16% 47%',

  accent: '210 40% 96%',
  'accent-foreground': '221 83% 43%',

  destructive: '0 72% 51%',
  'destructive-foreground': '0 0% 100%',

  border: '214 32% 91%',
  input: '214 32% 91%',
  ring: '221 83% 53%',

  radius: '0.5rem',

  // Перекриття темного режиму — окремий `.dark`-блок (клас на <html>).
  dark: {
    background: '222 47% 11%',
    foreground: '210 40% 98%',
    card: '222 47% 14%',
    'card-foreground': '210 40% 98%',
    border: '217 33% 20%',
    input: '217 33% 20%',
  },
};
