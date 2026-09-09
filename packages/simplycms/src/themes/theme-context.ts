import { createContext, useContext } from 'react';
import type { ThemeContextType } from './types';

/**
 * Обʼєкт React-контексту теми — НАВМИСНО окремим модулем від провайдера.
 *
 * `ThemeContext.tsx` тягне supabase-клієнт (провайдер читає активну тему з
 * БД), а conformance-kit (`simplycms/themes/conformance`) мусить підставити
 * значення контексту БЕЗ БД — рендер на фікстурах. Спільний модуль
 * гарантує, що обидва боки бачать ОДИН і той самий обʼєкт контексту: два
 * `createContext` дали б view теми `null` замість налаштувань.
 */
export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeSettings<T = unknown>(key: string): T | undefined {
  const { themeSettings } = useTheme();
  return themeSettings[key] as T | undefined;
}
