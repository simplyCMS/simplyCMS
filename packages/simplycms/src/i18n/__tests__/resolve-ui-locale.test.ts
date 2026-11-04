import { describe, expect, it } from 'vitest';
import { checkedContentLocale } from 'simplycms/domain/translations';
import { hasUiPack, resolveUiLocale, toUiLocale } from '../ui-locale';

// Мова контенту — через єдиний конструктор, а не `as`: тест не обходить межу осей.
const c = checkedContentLocale;

describe('resolveUiLocale (І42): міст осі контенту до осі інтерфейсу', () => {
  it('мова з точним пакетом — він', () => {
    expect(resolveUiLocale(c('uk'), c('uk'))).toBe('uk');
  });

  it('регіональний код → пакет базової мови', () => {
    expect(resolveUiLocale(c('en-GB'), c('uk'))).toBe('en');
  });

  it('мова без пакета → пакет основної мови магазину', () => {
    expect(resolveUiLocale(c('pl'), c('uk'))).toBe('uk');
    expect(resolveUiLocale(c('pl'), c('en'))).toBe('en');
  });

  it('жодного пакета ні для мови, ні для основної — помилка з переліком наявних (Р7)', () => {
    expect(() => resolveUiLocale(c('pl'), c('pl'))).toThrow(/uk.*en|en.*uk/);
  });
});

describe('hasUiPack і toUiLocale', () => {
  it('hasUiPack: базова мова знаходить пакет, чужа — ні', () => {
    expect(hasUiPack(c('en-GB'))).toBe(true);
    expect(hasUiPack(c('pl'))).toBe(false);
  });

  it('toUiLocale приймає лише ТОЧНИЙ код наявного пакета', () => {
    expect(toUiLocale('en')).toBe('en');
    expect(toUiLocale('en-GB')).toBeNull();
    expect(toUiLocale(null)).toBeNull();
  });
});
