import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeRegistry } from './ThemeRegistry';
import { ThemeContext } from './theme-context';
import { resolveDefaultThemeSettings } from './theme-settings';
import type { ThemeContextType, ThemeModule } from './types';

// Сам обʼєкт контексту й хуки читання живуть у `theme-context.ts` — тут лише
// провайдер. Ре-експорт нижче зберігає публічний шлях
// `simplycms/themes/ThemeContext` для наявних імпортів.
export { useTheme, useThemeSettings } from './theme-context';

const DEFAULT_THEME_NAME = 'default';

interface ThemeProviderProps {
  children: React.ReactNode;
  fallbackTheme?: string;
  /**
   * Назва активної теми, зрезолвлена СЕРВЕРОМ.
   *
   * 🔴 Обовʼязкова. До В2 провайдер умів дочитати тему сам — запитом
   * `themes` з браузера через PostgREST. Тепер джерело одне: лоадер
   * каркасного роуту (`getActiveTheme` → `loadActiveTheme` → `withStorefrontDb`).
   * Другий шлях не «резервний», а розбіжний: він давав інший знімок БД, ніж
   * SSR, і показував би тему, якої сервер не рендерив.
   */
  initialThemeName: string;
  /** Збережені налаштування теми з того самого лоадера. */
  initialThemeSettings?: Record<string, unknown>;
}

export function ThemeProvider({
  children,
  fallbackTheme = DEFAULT_THEME_NAME,
  initialThemeName,
  initialThemeSettings,
}: ThemeProviderProps) {
  const [activeTheme, setActiveTheme] = useState<ThemeModule | null>(null);
  const [themeName, setThemeName] = useState<string>(initialThemeName);
  const [themeSettings, setThemeSettings] = useState<Record<string, unknown>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const didInit = useRef(false);

  const loadTheme = useCallback(
    async (name: string, settings?: Record<string, unknown>) => {
      try {
        if (!ThemeRegistry.has(name)) {
          if (name !== fallbackTheme && ThemeRegistry.has(fallbackTheme)) {
            return loadTheme(fallbackTheme, settings);
          }
          throw new Error(`Theme "${name}" is not available`);
        }

        const theme = await ThemeRegistry.load(name);
        setActiveTheme(theme);
        setThemeName(name);

        // Злиття default settings зі збереженими. Контракт v2: схема
        // налаштувань лежить у `module.settings`, а не в маніфесті
        // (маніфест — лише паспорт теми).
        setThemeSettings({
          ...resolveDefaultThemeSettings(theme.settings),
          ...(settings ?? {}),
        });
      } catch (err) {
        console.error(`[ThemeProvider] Failed to load theme "${name}":`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [fallbackTheme],
  );

  /**
   * Перечитати МОДУЛЬ активної теми (скидає кеш реєстру).
   *
   * Назву й налаштування перечитує лоадер роуту — саме він тепер єдине
   * джерело правди про активну тему, тож окремого походу в БД звідси немає.
   */
  const refreshTheme = useCallback(async () => {
    ThemeRegistry.clearCache();
    setIsLoading(true);
    await loadTheme(themeName, themeSettings);
    setIsLoading(false);
  }, [loadTheme, themeName, themeSettings]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    void loadTheme(initialThemeName, initialThemeSettings).then(() =>
      setIsLoading(false),
    );
  }, [initialThemeName, initialThemeSettings, loadTheme]);

  const value: ThemeContextType = {
    activeTheme,
    themeName,
    themeSettings,
    isLoading,
    error,
    refreshTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
