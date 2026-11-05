import { describe, expect, it } from 'vitest';
import { checkedContentLocale } from 'simplycms/domain/translations';
import { resolveUiLocale, toUiLocale } from '../ui-locale';

// Мова контенту — через єдиний конструктор, а не `as`: тест не обходить межу осей.
const c = checkedContentLocale;

describe('resolveUiLocale (І42): міст осі контенту до осі інтерфейсу', () => {
  it('мова з точним пакетом — він', () => {
    expect(resolveUiLocale(c('uk'), c('uk'))).toBe('uk');
  });

  it('регіональний код → пакет базової мови', () => {
    expect(resolveUiLocale(c('en-GB'), c('uk'))).toBe('en');
  });

  it('деградований режим: опублікована мова без пакета → пакет основної мови', () => {
    expect(resolveUiLocale(c('pl'), c('uk'))).toBe('uk');
    expect(resolveUiLocale(c('pl'), c('en'))).toBe('en');
  });

  it('жодного пакета ні для мови, ні для основної — помилка з переліком наявних (Р7)', () => {
    expect(() => resolveUiLocale(c('pl'), c('pl'))).toThrow(/uk.*en|en.*uk/);
  });
});

describe('toUiLocale', () => {
  it('приймає лише ТОЧНИЙ код наявного пакета', () => {
    expect(toUiLocale('en')).toBe('en');
    expect(toUiLocale('en-GB')).toBeNull();
    expect(toUiLocale(null)).toBeNull();
  });

  it('частини: `admin` у пакетів платформи є, `fr` — немає пакета взагалі', () => {
    expect(toUiLocale('uk', ['admin'])).toBe('uk');
    expect(toUiLocale('fr', ['admin'])).toBeNull();
  });
});
