import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSupabaseClient } from "@simplycms/core/supabase/SupabaseProvider";
import { ThemeRegistry } from "./ThemeRegistry";
import type {
  ThemeContextType,
  ThemeModule,
  ThemeRecord,
} from "./types";

/** Конвертація hex (#RRGGBB) у HSL "H S% L%" для CSS variables */
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const DEFAULT_THEME_NAME = "default";

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
    initialThemeName || DEFAULT_THEME_NAME
  );
  const [themeSettings, setThemeSettings] = useState<Record<string, unknown>>(
    {}
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

        // Злиття default settings з збереженими
        const defaultSettings: Record<string, unknown> = {};
        if (theme.manifest.settings) {
          for (const [key, setting] of Object.entries(
            theme.manifest.settings
          )) {
            defaultSettings[key] = setting.default;
          }
        }

        const savedSettings = record?.settings || {};
        setThemeSettings({ ...defaultSettings, ...savedSettings });
      } catch (err) {
        console.error(
          `[ThemeProvider] Failed to load theme "${name}":`,
          err
        );
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [fallbackTheme]
  );

  const fetchActiveTheme = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("themes")
        .select("*")
        .eq("is_active", true)
        .single();

      if (fetchError) {
        console.error(
          "[ThemeProvider] Error fetching active theme:",
          fetchError
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
      console.error("[ThemeProvider] Failed to initialize theme:", err);
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

  // CSS variables для налаштувань теми
  useEffect(() => {
    if (!themeSettings || Object.keys(themeSettings).length === 0) return;

    const root = document.documentElement;

    if (
      themeSettings.primaryColor &&
      typeof themeSettings.primaryColor === "string"
    ) {
      const hsl = hexToHsl(themeSettings.primaryColor);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--brand", hsl);
      }
    }

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--brand");
    };
  }, [themeSettings]);

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

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function useThemeSettings<T = unknown>(key: string): T | undefined {
  const { themeSettings } = useTheme();
  return themeSettings[key] as T | undefined;
}
