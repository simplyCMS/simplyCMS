import { z } from 'zod';
import type { ZodObject, ZodRawShape } from 'zod';

/**
 * Проєкція JSON Schema, яку рендерить форма налаштувань плагіна. Джерело —
 * `z.toJSONSchema` від схеми з `definePlugin({ settings })`: конвенція SDK —
 * `.describe()` дає підпис поля, `z.enum` стає select-ом, `.default()` —
 * значенням за замовчуванням.
 */
export interface SettingsField {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  description?: string;
}

/**
 * Поля форми зі Zod-схеми. `z.toJSONSchema` кидає на непредставних типах
 * (z.date(), .transform(), z.custom) — а `validatePluginModule` перевіряє
 * лише «схожість на Zod-схему», тож сюди може доїхати легальна для Zod, але
 * непредставна для форми схема. Це не привід валити сторінку адмінки
 * (дух §8 «ніяких падінь від плагіна»): warn + «немає налаштувань».
 */
export function settingsFields(
  schema: ZodObject<ZodRawShape> | undefined,
): [string, SettingsField][] {
  if (!schema) return [];
  try {
    const jsonSchema = z.toJSONSchema(schema) as {
      properties?: Record<string, SettingsField>;
    };
    return Object.entries(jsonSchema.properties ?? {});
  } catch (error) {
    console.warn(
      '[admin] settings-схема плагіна непредставна у формі:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
