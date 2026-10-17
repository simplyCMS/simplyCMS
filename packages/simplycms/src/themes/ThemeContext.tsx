import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type ThemeOutcome =
  | {
      request: number;
      resolved: string;
      theme: ThemeModule;
      settings?: Record<string, unknown>;
    }
  | { request: number; error: Error };

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

  // Номер останнього запиту `resolveTheme`. Модуль теми вантажиться асинхронно:
  // дві швидкі зміни (A → B) можуть завершитись у зворотному порядку, і без
  // перевірки пізній результат A перезаписав би вже показану B.
  const requestRef = useRef(0);

  /**
   * Завантажує модуль теми БЕЗ жодного `setState` — повертає результат.
   * Застосування (`applyOutcome`) окремо й викликається лише з `.then`: так
   * ефект ніколи не ставить стан синхронно у своєму тілі
   * (`react-hooks/set-state-in-effect`), і це не обхід, а справжній поділ
   * «завантажити» / «застосувати».
   */
  const resolveTheme = useCallback(
    async (
      name: string,
      settings?: Record<string, unknown>,
    ): Promise<ThemeOutcome> => {
      const request = ++requestRef.current;
      const resolved = ThemeRegistry.has(name)
        ? name
        : name !== fallbackTheme && ThemeRegistry.has(fallbackTheme)
          ? fallbackTheme
          : null;
      try {
        if (resolved === null)
          throw new Error(`Theme "${name}" is not available`);
        const theme = await ThemeRegistry.load(resolved);
        return { request, resolved, theme, settings };
      } catch (err) {
        console.error(`[ThemeProvider] Failed to load theme "${name}":`, err);
        return {
          request,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
    [fallbackTheme],
  );

  /** Повертає `false`, якщо результат застарів (його відкинуто). */
  const applyOutcome = useCallback((outcome: ThemeOutcome) => {
    if (outcome.request !== requestRef.current) return false;
    if ('error' in outcome) {
      setError(outcome.error);
      return true;
    }
    setActiveTheme(outcome.theme);
    setThemeName(outcome.resolved);
    // Злиття default settings зі збереженими. Контракт v2: схема
    // налаштувань лежить у `module.settings`, а не в маніфесті
    // (маніфест — лише паспорт теми).
    setThemeSettings({
      ...resolveDefaultThemeSettings(outcome.theme.settings),
      ...(outcome.settings ?? {}),
    });
    // Успіх знімає помилку попередньої спроби: інакше збій однієї теми
    // «прилип» би до наступної, що завантажилась.
    setError(null);
    return true;
  }, []);

  /**
   * Перечитати МОДУЛЬ активної теми (скидає кеш реєстру).
   *
   * Назву й налаштування перечитує лоадер роуту — саме він тепер єдине
   * джерело правди про активну тему, тож окремого походу в БД звідси немає.
   */
  const refreshTheme = useCallback(async () => {
    ThemeRegistry.clearCache();
    setIsLoading(true);
    if (applyOutcome(await resolveTheme(themeName, themeSettings)))
      setIsLoading(false);
  }, [resolveTheme, applyOutcome, themeName, themeSettings]);

  // Ключ за ЗМІСТОМ, а не за посиланням: лоадер віддає новий обʼєкт на кожне
  // оновлення, і залежність від посилання перезавантажувала б тему щоразу
  // (а прибраний `didInit` зробив би це циклом). Об'єкт для ефекту
  // відновлюється з ключа й мемоїзується по ньому ж, тож залежності чесні.
  const settingsKey = JSON.stringify(initialThemeSettings ?? {});
  const stableSettings = useMemo<Record<string, unknown>>(
    () => JSON.parse(settingsKey) as Record<string, unknown>,
    [settingsKey],
  );

  // Нові `initialThemeName`/налаштування (власник зберіг у адмінці, лоадер
  // інвалідовано) застосовуються без перезавантаження сторінки (Е6б-16).
  useEffect(() => {
    void resolveTheme(initialThemeName, stableSettings).then((outcome) => {
      if (applyOutcome(outcome)) setIsLoading(false);
    });
  }, [initialThemeName, stableSettings, resolveTheme, applyOutcome]);

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
