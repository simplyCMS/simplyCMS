// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatPrice } from 'simplycms/domain/money';
import { TestI18nProvider } from '../../../test-harness/i18n';
import { ui } from '../../../test-harness/locale';
import { useFormatDate } from '../format';

afterEach(cleanup);

describe('форматування за мовою інтерфейсу (§19.8)', () => {
  const NBSP = ' ';

  it('formatPrice: en — кома групує, крапка відокремлює копійки', () => {
    expect(
      formatPrice(
        1234.5,
        { locale: ui('en'), currency: 'UAH' },
        { minimumFractionDigits: 2 },
      ),
    ).toBe(`1,234.50${NBSP}₴`);
  });

  it('formatPrice: uk — за правилами української', () => {
    const number = new Intl.NumberFormat('uk', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.5);
    expect(
      formatPrice(
        1234.5,
        { locale: ui('uk'), currency: 'UAH' },
        { minimumFractionDigits: 2 },
      ),
    ).toBe(`${number}${NBSP}₴`);
  });

  const dateIn = (
    locale: 'uk' | 'en',
    style?: 'medium' | 'short' | 'datetime',
  ) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestI18nProvider locale={locale}>{children}</TestI18nProvider>
    );
    return renderHook(() => useFormatDate(style), { wrapper }).result.current(
      new Date(2026, 10, 4, 15, 30),
    );
  };

  it('useFormatDate: дата йде за мовою інтерфейсу, а не за хардкодом', () => {
    expect(dateIn('en')).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
        new Date(2026, 10, 4),
      ),
    );
    expect(dateIn('uk')).not.toBe(dateIn('en'));
  });

  it('useFormatDate: datetime — довга дата й час за мовою інтерфейсу', () => {
    const at = new Date(2026, 10, 4, 15, 30);
    for (const locale of ['en', 'uk'] as const) {
      expect(dateIn(locale, 'datetime')).toBe(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(at),
      );
    }
    expect(dateIn('en', 'datetime')).not.toBe(dateIn('uk', 'datetime'));
  });
});
