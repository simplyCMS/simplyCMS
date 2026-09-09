// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { useTheme } from '../theme-context';
import { ThemeRegistry } from '../ThemeRegistry';
import type { ThemeModule } from '../types';

/**
 * 🔴 Доказ, а не переказ: `loadTheme` у `ThemeContext.tsx` робить
 * `{ ...defaultSettings, ...savedSettings }`.
 *
 * 🔴 Шлях ініціалізації тепер ОДИН (В2, рішення B9): назву й налаштування
 * активної теми дає лоадер каркасного роуту, і другої гілки — клієнтського
 * запиту `themes` через PostgREST — більше немає. Тест на неї знято разом із
 * нею: браузер до БД не звертається взагалі, тож «тема з другого джерела»
 * не могла б розійтися з тим, що зрендерив сервер.
 *
 * 🔴 Готовність `themeSettings` перевіряється саме по вмісту, а не по
 * `isLoading`: модуль теми довантажується в ефекті, тобто на тік пізніше за
 * перший рендер.
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

afterEach(() => {
  for (const name of ThemeRegistry.getRegisteredThemes()) {
    ThemeRegistry.unregister(name);
  }
  ThemeRegistry.clearCache();
  vi.restoreAllMocks();
});

describe('ThemeProvider — злиття default-ів зі збереженими settings (Р9а)', () => {
  it('ключ із лоадера перекриває default, відсутній ключ читається як default', async () => {
    ThemeRegistry.register(THEME_NAME, () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider
        initialThemeName={THEME_NAME}
        initialThemeSettings={{ accent: '#ff0000' }}
      >
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() =>
      expect(result.current.themeSettings.accent).toBe('#ff0000'),
    );

    // Є в initialThemeSettings (рядок БД через лоадер) — значення з БД.
    expect(result.current.themeSettings.accent).toBe('#ff0000');
    // Відсутній у initialThemeSettings — має лишитись default зі схеми.
    expect(result.current.themeSettings.title).toBe('#222222');
  });

  it('без initialThemeSettings: усі значення — default зі схеми', async () => {
    ThemeRegistry.register(THEME_NAME, () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider initialThemeName={THEME_NAME}>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() =>
      expect(result.current.themeSettings).toEqual({
        accent: '#111111',
        title: '#222222',
      }),
    );
  });

  it('невідома тема з лоадера → fallback, і БЕЗ жодного походу в БД', async () => {
    ThemeRegistry.register('default', () =>
      Promise.resolve({ default: makeTheme() }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider initialThemeName="ghost-theme">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.themeName).toBe('default');
    expect(result.current.error).toBeNull();
  });
});
