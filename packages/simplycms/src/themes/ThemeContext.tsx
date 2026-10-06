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
   * каркасного роуту (`getActiveTheme` → `loadActiveTheme` → `withStorefrontDb`
   * крізь спільний кеш `activeThemeCache` з `simplycms/site`).
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

  // Номер останнього запиту `loadTheme`. Модуль теми вантажиться асинхронно:
  // дві швидкі зміни (A → B) можуть завершитись у зворотному порядку, і без
  // перевірки пізній результат A перезаписав би вже показану B.
  const requestRef = useRef(0);

  /** Повертає `false`, якщо результат застарів (його відкинуто). */
  const loadTheme = useCallback(
    async (name: string, settings?: Record<string, unknown>) => {
      const request = ++requestRef.current;
      const current = () => request === requestRef.current;
      try {
        const resolved = ThemeRegistry.has(name)
          ? name
          : name !== fallbackTheme && ThemeRegistry.has(fallbackTheme)
            ? fallbackTheme
            : null;
        if (resolved === null)
          throw new Error(`Theme "${name}" is not available`);

        const theme = await ThemeRegistry.load(resolved);
        if (!current()) return false;
        setActiveTheme(theme);
        setThemeName(resolved);

        // Злиття default settings зі збереженими. Контракт v2: схема
        // налаштувань лежить у `module.settings`, а не в маніфесті
        // (маніфест — лише паспорт теми).
        setThemeSettings({
          ...resolveDefaultThemeSettings(theme.settings),
          ...(settings ?? {}),
        });
        // Успіх знімає помилку попередньої спроби: інакше збій однієї теми
        // «прилип» би до наступної, що завантажилась.
        setError(null);
      } catch (err) {
        if (!current()) return false;
        console.error(`[ThemeProvider] Failed to load theme "${name}":`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      return true;
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
    if (await loadTheme(themeName, themeSettings)) setIsLoading(false);
  }, [loadTheme, themeName, themeSettings]);

  // Ключ за ЗМІСТОМ, а не за посиланням: лоадер віддає новий обʼєкт на кожне
  // оновлення, і залежність від посилання перезавантажувала б тему щоразу
  // (а прибраний `didInit` зробив би це циклом).
  const settingsKey = JSON.stringify(initialThemeSettings ?? {});

  // Нові `initialThemeName`/налаштування (власник зберіг у адмінці, лоадер
  // інвалідовано) застосовуються без перезавантаження сторінки (Е6б-16).
  // `initialThemeSettings` навмисно читається із замикання, а не з масиву
  // залежностей: його вміст уже представлено `settingsKey`.
  useEffect(() => {
    void loadTheme(initialThemeName, initialThemeSettings).then((applied) => {
      if (applied) setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThemeName, settingsKey, loadTheme]);

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
