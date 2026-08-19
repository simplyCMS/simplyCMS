// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SupabaseProvider } from '@simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from '@simplycms/supabase/browser-client';
import { ThemeProvider } from '../ThemeContext';
import { useTheme } from '../theme-context';
import { ThemeRegistry } from '../ThemeRegistry';
import type { ThemeModule } from '../types';

/**
 * 🔴 Фаза 8, Step 1 (Р9а) — доказ, а не переказ: `loadTheme` у
 * `ThemeContext.tsx` уже робить `{ ...defaultSettings, ...savedSettings }`.
 * Тест ловить регрес на ОБОХ шляхах ініціалізації — SSR (`initialThemeName`)
 * і клієнтський fetch (`supabase.from('themes')...`) — бо це два різні
 * виклики `loadTheme` з різним походженням `record`.
 *
 * 🔴 Асиметрія, знайдена цим тестом (НЕ дірка в самому злитті): на SSR-гілці
 * `isLoading` ініціалізується як `false` одразу (`!initialThemeName`), а
 * `themeSettings` заповнюється лише після того, як `loadTheme` довантажить
 * модуль теми з `ThemeRegistry` — це відбувається в ефекті, тобто на тік
 * пізніше. Тому тести чекають (`waitFor`) саме на вміст `themeSettings`, а
 * не на `isLoading === false`: останній не є надійним сигналом готовності
 * налаштувань на цьому шляху. Сьогодні жоден компонент не читає `isLoading`
 * з `useTheme()`, а `useActiveThemeModule` резолвиться через окремий
 * Suspense (`use(ThemeRegistry.load(...))`), тож це не production-регрес —
 * але про нюанс варто памʼятати, якщо `isLoading` колись стане публічним
 * сигналом готовності `themeSettings`.
 */

const THEME_NAME = 'settings-merge-theme';

const settingsSchema = {
  accent: { type: 'color' as const, default: '#111111', label: 'Accent' },
  title: { type: 'color' as const, default: '#222222', label: 'Title' },
};

function makeTheme(): ThemeModule {
  return {
    manifest: {
      name: THEME_NAME,
      displayName: THEME_NAME,
      version: '1.0.0',
      engines: { simplycms: '>=0.1.0' },
    },
    tokens: { primary: '221 83% 53%' },
    components: { Header: () => null, Footer: () => null },
    settings: settingsSchema,
  };
}

/** Двійник `supabase.from('themes').select('*').eq('is_active', true).single()`. */
function makeSupabase(row: Record<string, unknown> | null): SupabaseClient {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

afterEach(() => {
  for (const name of ThemeRegistry.getRegisteredThemes()) {
    ThemeRegistry.unregister(name);
  }
  ThemeRegistry.clearCache();
  vi.restoreAllMocks();
});

describe('ThemeProvider — злиття default-ів зі збереженими settings (Р9а)', () => {
  it('SSR-гілка (initialThemeName): ключ з БД перекриває default, відсутній ключ читається як default', async () => {
    ThemeRegistry.register(THEME_NAME, () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SupabaseProvider client={makeSupabase(null)}>
        <ThemeProvider
          initialThemeName={THEME_NAME}
          initialThemeSettings={{ accent: '#ff0000' }}
        >
          {children}
        </ThemeProvider>
      </SupabaseProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() =>
      expect(result.current.themeSettings.accent).toBe('#ff0000'),
    );

    // Є в initialThemeSettings (БД через SSR) — значення з БД, не default.
    expect(result.current.themeSettings.accent).toBe('#ff0000');
    // Відсутній у initialThemeSettings — має лишитись default зі схеми.
    expect(result.current.themeSettings.title).toBe('#222222');
  });

  it('клієнтський fetch (без initialThemeName): те саме злиття з рядка supabase.from("themes")', async () => {
    ThemeRegistry.register(THEME_NAME, () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const row = {
      id: 'theme-1',
      name: THEME_NAME,
      display_name: THEME_NAME,
      version: '1.0.0',
      description: null,
      author: null,
      preview_image: null,
      is_active: true,
      settings: { accent: '#ff0000' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SupabaseProvider client={makeSupabase(row)}>
        <ThemeProvider>{children}</ThemeProvider>
      </SupabaseProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.themeSettings.accent).toBe('#ff0000');
    expect(result.current.themeSettings.title).toBe('#222222');
  });

  it('SSR-гілка без initialThemeSettings: усі значення — default зі схеми', async () => {
    ThemeRegistry.register(THEME_NAME, () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SupabaseProvider client={makeSupabase(null)}>
        <ThemeProvider initialThemeName={THEME_NAME}>{children}</ThemeProvider>
      </SupabaseProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() =>
      expect(result.current.themeSettings).toEqual({
        accent: '#111111',
        title: '#222222',
      }),
    );
  });
});
