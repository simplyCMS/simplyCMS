import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { ThemeRegistry } from './ThemeRegistry';
import { ThemeContext } from './theme-context';
import { resolveDefaultThemeSettings } from './theme-settings';
import type { ThemeContextType, ThemeModule, ThemeRecord } from './types';

// Сам обʼєкт контексту й хуки читання живуть у `theme-context.ts` (модуль без
// supabase) — тут лише провайдер. Ре-експорт нижче зберігає публічний шлях
// `@simplycms/themes/ThemeContext` для наявних імпортів.
export { useTheme, useThemeSettings } from './theme-context';

const DEFAULT_THEME_NAME = 'default';

interface ThemeProviderProps {
  children: React.ReactNode;
  fallbackTheme?: string;
  /** Назва теми з SSR — пропускає початковий fetchActiveTheme */
  initialThemeName?: string;
  /** Збережені налаштування теми з БД (передані через SSR) */
  initialThemeSettings?: Record<string, unknown>;
}

export function ThemeProvider({
  children,
  fallbackTheme = DEFAULT_THEME_NAME,
  initialThemeName,
  initialThemeSettings,
}: ThemeProviderProps) {
  const supabase = useSupabaseClient();
  const [activeTheme, setActiveTheme] = useState<ThemeModule | null>(null);
  const [themeName, setThemeName] = useState<string>(
    initialThemeName || DEFAULT_THEME_NAME,
  );
  const [themeSettings, setThemeSettings] = useState<Record<string, unknown>>(
    {},
  );
  const [themeRecord, setThemeRecord] = useState<ThemeRecord | null>(null);
  const [isLoading, setIsLoading] = useState(!initialThemeName);
  const [error, setError] = useState<Error | null>(null);
  const didInit = useRef(false);

  const loadTheme = useCallback(
    async (name: string, record?: ThemeRecord) => {
      try {
        if (!ThemeRegistry.has(name)) {
          if (name !== fallbackTheme && ThemeRegistry.has(fallbackTheme)) {
            return loadTheme(fallbackTheme);
          }
          throw new Error(`Theme "${name}" is not available`);
        }

        const theme = await ThemeRegistry.load(name);
        setActiveTheme(theme);
        setThemeName(name);

        // Злиття default settings зі збереженими.
        // Контракт v2: схема налаштувань лежить у `module.settings`,
        // а не в маніфесті (маніфест — лише паспорт теми).
        const defaultSettings = resolveDefaultThemeSettings(theme.settings);

        const savedSettings = record?.settings || {};
        setThemeSettings({ ...defaultSettings, ...savedSettings });
      } catch (err) {
        console.error(`[ThemeProvider] Failed to load theme "${name}":`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [fallbackTheme],
  );

  const fetchActiveTheme = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .single();

      if (fetchError) {
        console.error(
          '[ThemeProvider] Error fetching active theme:',
          fetchError,
        );
        await loadTheme(fallbackTheme);
        return;
      }

      if (!data) {
        await loadTheme(fallbackTheme);
        return;
      }

      const settingsData = data.settings as Record<string, unknown> | null;

      const record: ThemeRecord = {
        id: data.id,
        name: data.name,
        display_name: data.display_name,
        version: data.version,
        description: data.description,
        author: data.author,
        preview_image: data.preview_image,
        is_active: data.is_active,
        settings: settingsData || {},
        created_at: data.created_at ?? new Date().toISOString(),
        updated_at: data.updated_at ?? new Date().toISOString(),
      };

      setThemeRecord(record);
      await loadTheme(record.name, record);
    } catch (err) {
      console.error('[ThemeProvider] Failed to initialize theme:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [fallbackTheme, loadTheme, supabase]);

  const refreshTheme = useCallback(async () => {
    ThemeRegistry.clearCache();
    await fetchActiveTheme();
  }, [fetchActiveTheme]);

  // Ініціалізація: якщо є initialThemeName — завантажуємо з Registry без fetch
  // Якщо ні — робимо fetch з БД
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (initialThemeName) {
      // Формуємо частковий ThemeRecord зі збереженими settings з SSR
      const ssrRecord = initialThemeSettings
        ? ({ settings: initialThemeSettings } as ThemeRecord)
        : undefined;
      loadTheme(initialThemeName, ssrRecord).then(() => setIsLoading(false));
    } else {
      fetchActiveTheme();
    }
  }, [initialThemeName, initialThemeSettings, loadTheme, fetchActiveTheme]);

  const value: ThemeContextType = {
    activeTheme,
    themeName,
    themeSettings,
    themeRecord,
    isLoading,
    error,
    refreshTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
