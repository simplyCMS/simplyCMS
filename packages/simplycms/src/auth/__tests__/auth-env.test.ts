import { describe, expect, it } from 'vitest';
import { resolveAuthBaseUrl, resolveAuthSecret } from '../auth-env';

// Контракт серверного env auth-контуру (спека CLI v1 §7, Task 7).
//
// 🔴 Що саме доводиться тут — ФОРМА резолву, а не джерело: у vitest
// `import.meta.env` — Proxy над `process.env`, тож тест джерело довести не
// здатен у принципі (той самий урок, що з фабрикою пулу БД). Джерело
// стереже лінт-зона `import.meta.env` у серверних модулях.

describe('resolveAuthSecret', () => {
  it('віддає заданий секрет', () => {
    expect(resolveAuthSecret({ BETTER_AUTH_SECRET: 's3cret' })).toBe('s3cret');
  });

  it.each([[{}], [{ BETTER_AUTH_SECRET: '' }]])('падає гучно на %j', (env) => {
    // Тихий фолбек на випадковий секрет дав би розлогін усіх користувачів
    // після кожного перезапуску — симптом далеко від причини.
    expect(() => resolveAuthSecret(env)).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe('resolveAuthBaseUrl', () => {
  it('BETTER_AUTH_URL — явний override', () => {
    expect(
      resolveAuthBaseUrl({
        BETTER_AUTH_URL: 'https://auth.test',
        VITE_SITE_URL: 'https://site.test',
      }),
    ).toBe('https://auth.test');
  });

  it('Р18а/M6: без override — ORIGIN VITE_SITE_URL (шлях ігнорується, як у siteUrl)', () => {
    expect(
      resolveAuthBaseUrl({ VITE_SITE_URL: 'https://site.test/shop/' }),
    ).toBe('https://site.test');
    expect(
      resolveAuthBaseUrl({
        BETTER_AUTH_URL: '',
        VITE_SITE_URL: 'https://site.test',
      }),
    ).toBe('https://site.test');
  });

  it.each([[{}], [{ BETTER_AUTH_URL: '', VITE_SITE_URL: '' }]])(
    'I1: без обох ключів падає гучно й називає обидва (S3-01 не відкривається мовчки) %j',
    (env) => {
      expect(() => resolveAuthBaseUrl(env)).toThrow(/BETTER_AUTH_URL/);
      expect(() => resolveAuthBaseUrl(env)).toThrow(/VITE_SITE_URL/);
    },
  );

  it.each(['not a url', '/relative', 'http://'])(
    'A: недійсний BETTER_AUTH_URL (%j) падає з імʼям ключа, без значення і без голої TypeError',
    (bad) => {
      const attempt = () =>
        resolveAuthBaseUrl({
          BETTER_AUTH_URL: bad,
          VITE_SITE_URL: 'https://site.test',
        });
      expect(attempt).toThrow(/BETTER_AUTH_URL/);
      expect(attempt).not.toThrow(bad);
      expect(attempt).not.toThrow(TypeError);
    },
  );
});
