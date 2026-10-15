import { describe, expect, it } from 'vitest';
import {
  CSRF_EXEMPT_PREFIXES,
  csrfMiddleware,
  shouldValidateCsrf,
} from '../csrf';

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

describe('csrfMiddleware — origin запиту з конфігу сайту (Р18б)', () => {
  type ServerFn = (ctx: {
    request: Request;
    next: () => unknown;
  }) => Promise<unknown>;
  const server = (
    csrfMiddleware as unknown as { options: { server: ServerFn } }
  ).options.server;

  it('request.url на origin сайту, Origin чужий, без Sec-Fetch-Site → 403', async () => {
    const result = await server({
      request: new Request('https://shop.test/_serverFn/x', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: '{}',
      }),
      next: () => 'next',
    });
    expect((result as Response).status).toBe(403);
  });

  it('контроль: Origin сайту проходить', async () => {
    const result = await server({
      request: new Request('https://shop.test/_serverFn/x', {
        method: 'POST',
        headers: { origin: 'https://shop.test' },
        body: '{}',
      }),
      next: () => 'next',
    });
    expect(result).toBe('next');
  });
});
