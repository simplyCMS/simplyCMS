// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { plural } from 'simplycms/i18n';
import { TestI18nProvider } from '../../../test-harness/i18n';
import { ThemeRegistry } from '../ThemeRegistry';
import { useThemeT } from '../useThemeT';
import { makeTheme } from './conformance-themes';

// Хук бере назву теми з контексту; сам реєстр і `use()` — справжні.
vi.mock('../ThemeContext', () => ({
  useTheme: () => ({ themeName: 'use-theme-t-fixture' }),
}));

const theme = makeTheme(undefined, {
  messages: {
    // Ключ є і в мові інтерфейсу, і в fallback — має перемогти мова інтерфейсу.
    uk: {
      'theme.title': 'Заголовок',
      'theme.n': {
        one: '{count} штука',
        few: '{count} штуки',
        many: '{count} штук',
        other: '{count} штуки',
      },
    },
    en: {
      'theme.title': 'Title',
      'theme.n': { one: '{count} piece', other: '{count} pieces' },
      'theme.onlyEn': 'Only en',
    },
  },
});

const wrap =
  (locale: 'uk' | 'en') =>
  ({ children }: { children: ReactNode }) => (
    <TestI18nProvider locale={locale}>{children}</TestI18nProvider>
  );

beforeAll(async () => {
  ThemeRegistry.register('use-theme-t-fixture', async () => ({
    default: theme,
  }));
  // Розігрів кешу: `use()` у хуку тоді розгортає проміс синхронно.
  await ThemeRegistry.load('use-theme-t-fixture');
});

afterEach(cleanup);

describe('useThemeT', () => {
  it('порядок каталогів: мова інтерфейсу перемагає fallback, коли ключ є в обох', () => {
    // Fixture-провайдер ставить fallback = uk; interface = en.
    const { result } = renderHook(() => useThemeT(), { wrapper: wrap('en') });
    expect(result.current('theme.title')).toBe('Title');
  });

  it('ключа немає ні в мові інтерфейсу, ні у fallback — сам ключ', () => {
    const { result } = renderHook(() => useThemeT(), { wrapper: wrap('uk') });
    // uk — і мова, і fallback; `theme.onlyEn` є лише в en.
    expect(result.current('theme.onlyEn')).toBe('theme.onlyEn');
  });

  it('множина: транслятор теми працює з тією ж plural, що й ядро', () => {
    const uk = renderHook(() => useThemeT(), { wrapper: wrap('uk') }).result
      .current;
    const en = renderHook(() => useThemeT(), { wrapper: wrap('en') }).result
      .current;
    expect([1, 2, 5].map((n) => plural(uk, 'theme.n', n))).toEqual([
      '1 штука',
      '2 штуки',
      '5 штук',
    ]);
    expect([1, 2].map((n) => plural(en, 'theme.n', n))).toEqual([
      '1 piece',
      '2 pieces',
    ]);
  });
});
