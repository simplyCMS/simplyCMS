import { describe, expect, it } from 'vitest';
import { resolveAuthBaseUrl, resolveAuthSecret } from '../env';

// Контракт серверного env auth-контуру (спека CLI v1 §7, Task 7).
//
// 🔴 Що саме доводиться тут — ФОРМА резолву, а не джерело: у vitest
// `import.meta.env` — Proxy над `process.env`, тож тест джерело довести не
// здатен у принципі (той самий урок, що з Supabase-фабриками). Джерело
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
  it('опційний: без ключа — undefined, з порожнім — теж', () => {
    expect(resolveAuthBaseUrl({})).toBeUndefined();
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: '' })).toBeUndefined();
    expect(resolveAuthBaseUrl({ BETTER_AUTH_URL: 'https://a.test' })).toBe(
      'https://a.test',
    );
  });
});
