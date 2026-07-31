import { use } from "react";
import { useTheme } from "@simplycms/themes/ThemeContext";
import { ThemeRegistry } from "@simplycms/themes/ThemeRegistry";
import type { ThemeModule } from "@simplycms/themes/types";

/**
 * Активний модуль теми для канонічних сторінок і каркасів.
 *
 * `ThemeRegistry.load` віддає СТАБІЛЬНУ проміс-референцію, тому `use()` не
 * створює нового промісу на кожен рендер; коли тему вже прогріто (клієнт
 * робить це до гідрації), значення розгортається синхронно, без suspend.
 */
export function useActiveThemeModule(): ThemeModule {
  const { themeName } = useTheme();
  return use(ThemeRegistry.load(themeName));
}
