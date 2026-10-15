import { describe, expect, it } from 'vitest';
import { siteUrl } from '../site-url';

describe('siteUrl (Р18в)', () => {
  it('будує посилання від origin VITE_SITE_URL, відкидаючи шлях і слеш', () => {
    expect(
      siteUrl('/auth/invite?x=1', { VITE_SITE_URL: 'https://a.test/' }),
    ).toBe('https://a.test/auth/invite?x=1');
    expect(siteUrl('/p', { VITE_SITE_URL: 'https://a.test:8443/base/x' })).toBe(
      'https://a.test:8443/p',
    );
  });

  it('без ключа або з сміттям — помилка з імʼям ключа й без значення', () => {
    expect(() => siteUrl('/p', {})).toThrow(/VITE_SITE_URL/);
    let message = '';
    try {
      siteUrl('/p', { VITE_SITE_URL: 'not a url SECRET-X' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/VITE_SITE_URL/);
    expect(message).not.toContain('SECRET-X');
  });

  it('шлях без початкового "/" відхиляється', () => {
    expect(() =>
      siteUrl('evil.test', { VITE_SITE_URL: 'https://a.test' }),
    ).toThrow();
  });
});
