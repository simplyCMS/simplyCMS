import { describe, expect, it } from 'vitest';
import { CSRF_EXEMPT_PREFIXES, shouldValidateCsrf } from '../csrf';

describe('shouldValidateCsrf — які запити перевіряються', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get', 'options'])(
    'безпечний метод %s не перевіряється',
    (method) => {
      expect(shouldValidateCsrf(method, '/_serverFn/abc')).toBe(false);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])(
    'змінюючий метод %s перевіряється',
    (method) => {
      expect(shouldValidateCsrf(method, '/_serverFn/abc')).toBe(true);
      expect(shouldValidateCsrf(method, '/api/health')).toBe(true);
    },
  );

  it('POST під винятком не перевіряється', () => {
    expect(shouldValidateCsrf('POST', '/api/auth/sign-in/email')).toBe(false);
    expect(shouldValidateCsrf('DELETE', '/api/auth/')).toBe(false);
  });

  it('виняток — префікс із кінцевим слешем, а не підрядок', () => {
    // `/api/authx` і `/api/auth` без слеша не підпадають під виняток.
    expect(shouldValidateCsrf('POST', '/api/authx/hook')).toBe(true);
    expect(shouldValidateCsrf('POST', '/api/auth')).toBe(true);
    expect(shouldValidateCsrf('POST', '/x/api/auth/y')).toBe(true);
  });

  it('список винятків — рівно Better Auth', () => {
    expect([...CSRF_EXEMPT_PREFIXES]).toEqual(['/api/auth/']);
  });
});
