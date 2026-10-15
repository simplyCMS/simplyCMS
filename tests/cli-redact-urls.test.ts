import { describe, expect, it } from 'vitest';
import { redactUrls } from '../packages/cli/src/redact-urls.mjs';

describe('redactUrls', () => {
  it('маскує пароль, лишаючи схему, користувача й хост', () => {
    expect(redactUrls('x postgres://u:p@h:1/d y')).toBe(
      'x postgres://u:***@h:1/d y',
    );
    expect(redactUrls('postgresql://u:p%40ss@h/d?sslmode=require')).toBe(
      'postgresql://u:***@h/d?sslmode=require',
    );
  });

  it('невкодований @ у паролі не лишає хвоста; URL без пароля не чіпається', () => {
    expect(redactUrls('postgres://u:pa@ss@h/d')).toBe('postgres://u:***@h/d');
    expect(redactUrls('postgres://u@h/d')).toBe('postgres://u@h/d');
    expect(redactUrls('без урлів')).toBe('без урлів');
  });

  it('кілька URL в одному тексті', () => {
    const out = redactUrls('a postgres://u:1@h/d b postgres://v:2@g/e');
    expect(out).not.toMatch(/:1@|:2@/);
  });
});
