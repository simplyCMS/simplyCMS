// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { usePluginT } from '../usePluginT';
import type { PluginMessages } from '../types';

const messages: PluginMessages = {
  uk: {
    'plugin.demo.title': 'Заголовок',
    'plugin.demo.count': 'Питань: {count}',
  },
  en: { 'plugin.demo.title': 'Title' },
};

const wrap =
  (locale: 'uk' | 'en') =>
  ({ children }: { children: ReactNode }) => (
    <I18nProvider locale={locale}>{children}</I18nProvider>
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

  it('без каталогу — сирі ключі (видимий сигнал, не падіння)', () => {
    const { result } = renderHook(() => usePluginT(undefined), {
      wrapper: wrap('uk'),
    });
    expect(result.current('plugin.demo.title')).toBe('plugin.demo.title');
  });
});
