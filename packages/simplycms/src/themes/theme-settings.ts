import type { ThemeSettingDefinition } from './types';

/**
 * Default-значення налаштувань теми зі СХЕМИ (`ThemeModule.settings`).
 *
 * Єдина реалізація на два споживачі: `ThemeProvider` кладе поверх них
 * збережене в БД (`{ ...default, ...saved }`), conformance-kit рендерить
 * view теми рівно на цих default-ах — без БД. Дубль цієї петлі означав би
 * два різні уявлення про «значення за замовчуванням».
 */
export function resolveDefaultThemeSettings(
  definitions: Record<string, ThemeSettingDefinition> | undefined,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  if (!definitions) return defaults;

  for (const [key, definition] of Object.entries(definitions)) {
    defaults[key] = definition.default;
  }
  return defaults;
}
