import { z } from 'zod';

/**
 * Схема налаштувань (спека §7): форму з неї рендерить адмінка через
 * `z.toJSONSchema`, значення плагін читає `usePluginConfig`. Конвенція SDK:
 * `.describe()` — підпис поля у формі, `.default()` — значення за
 * замовчуванням.
 */
export const settings = z.object({
  maxVisible: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe('Max visible questions on the product page'),
});

export type FaqSettings = z.output<typeof settings>;
