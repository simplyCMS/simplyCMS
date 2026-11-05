// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { EngineContext } from 'simplycms/contracts';
import { TestI18nProvider } from '../../../test-harness/i18n';
import { EngineProvider } from '../EngineProvider';
import { useFormatPrice } from '../useFormatPrice';

afterEach(cleanup);

const ENGINE = {
  links: {},
  config: { currency: 'UAH' },
} as unknown as EngineContext;

const formatIn = (locale: 'uk' | 'en') => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestI18nProvider locale={locale}>
      <EngineProvider value={ENGINE}>{children}</EngineProvider>
    </TestI18nProvider>
  );
  return renderHook(() => useFormatPrice(), { wrapper }).result.current(
    1234.5,
    { minimumFractionDigits: 2 },
  );
};

describe('useFormatPrice (§19.8)', () => {
  it('формат числа йде за мовою інтерфейсу, валюта — з конфігу магазину', () => {
    expect(formatIn('en')).toBe('1,234.50 ₴');
    expect(formatIn('uk')).not.toBe(formatIn('en'));
    expect(formatIn('uk')).toContain('₴');
  });
});
