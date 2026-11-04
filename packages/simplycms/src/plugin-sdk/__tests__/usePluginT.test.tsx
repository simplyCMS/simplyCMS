// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { TestI18nProvider } from '../../../test-harness/i18n';
import { plural } from 'simplycms/i18n';
import { usePluginT } from '../usePluginT';
import type { PluginMessages } from '../types';

const messages: PluginMessages = {
  uk: {
    'plugin.demo.title': 'Заголовок',
    'plugin.demo.count': 'Питань: {count}',
  },
  en: { 'plugin.demo.title': 'Title' },
};

// Форми лише в uk: інтерфейс en добирає їх з fallback-ланки.
const pluralMessages: PluginMessages = {
  uk: {
    'plugin.demo.n': {
      one: '{count} товар',
      few: '{count} товари',
      many: '{count} товарів',
      other: '{count} товару',
    },
  },
  en: { 'plugin.demo.title': 'Title' },
};

const wrap =
  (locale: 'uk' | 'en') =>
  ({ children }: { children: ReactNode }) => (
    <TestI18nProvider locale={locale}>{children}</TestI18nProvider>
  );

afterEach(cleanup);

describe('usePluginT', () => {
  it('бере ключ з активної локалі', () => {
    const { result } = renderHook(() => usePluginT(messages), {
      wrapper: wrap('en'),
    });
    expect(result.current('plugin.demo.title')).toBe('Title');
  });

  it('fallback: en без ключа → uk → сам ключ', () => {
    const { result } = renderHook(() => usePluginT(messages), {
      wrapper: wrap('en'),
    });
    expect(result.current('plugin.demo.count', { count: 3 })).toBe('Питань: 3');
    expect(result.current('plugin.demo.missing')).toBe('plugin.demo.missing');
  });

  it('форми з fallback-ланки множаться за правилами fallback-мови: en + uk-форми, 5 → товарів', () => {
    const { result } = renderHook(() => usePluginT(pluralMessages), {
      wrapper: wrap('en'),
    });
    expect(plural(result.current, 'plugin.demo.n', 5)).toBe('5 товарів');
    expect(plural(result.current, 'plugin.demo.n', 21)).toBe('21 товар');
  });

  it('без каталогу — сирі ключі (видимий сигнал, не падіння)', () => {
    const { result } = renderHook(() => usePluginT(undefined), {
      wrapper: wrap('uk'),
    });
    expect(result.current('plugin.demo.title')).toBe('plugin.demo.title');
  });
});
