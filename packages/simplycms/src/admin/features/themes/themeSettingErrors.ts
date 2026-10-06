import type { ThemeSettingDefinition } from 'simplycms/themes/types';
import type { ThemeSettingsValues } from './useThemes';

/** Порушена межа числової настройки — ключ i18n і саме значення межі. */
export type ThemeSettingError = { kind: 'min' | 'max'; bound: number };

/**
 * Клієнтська перевірка меж `min`/`max` числових настройок теми.
 *
 * Чому на клієнті, а не на сервері: схема настройок живе в модулі теми, а
 * модуль — лише в браузері (Е6б-16); сервер перевіряє тільки форму й розмір
 * значень. Атрибути `min`/`max` в `<input>` значення не обмежують (набрати
 * 999 можна), тож без цієї перевірки межа теми лишалась би підказкою.
 */
export function themeSettingErrors(
  schema: Record<string, ThemeSettingDefinition>,
  values: ThemeSettingsValues,
): Record<string, ThemeSettingError> {
  const errors: Record<string, ThemeSettingError> = {};
  for (const [key, setting] of Object.entries(schema)) {
    const value = values[key];
    if (setting.type !== 'number' || typeof value !== 'number') continue;
    if (setting.min !== undefined && value < setting.min)
      errors[key] = { kind: 'min', bound: setting.min };
    else if (setting.max !== undefined && value > setting.max)
      errors[key] = { kind: 'max', bound: setting.max };
  }
  return errors;
}
