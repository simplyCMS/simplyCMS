import { describe, expect, it } from 'vitest';
import { checkedContentLocale } from '../content-locale';

describe('checkedContentLocale', () => {
  it('приймає код BCP 47 і повертає його як є', () => {
    expect(checkedContentLocale('pt-BR')).toBe('pt-BR');
  });

  it.each(['EN', ''])('відхиляє хибний код «%s»', (code) => {
    expect(() => checkedContentLocale(code)).toThrow();
  });
});
