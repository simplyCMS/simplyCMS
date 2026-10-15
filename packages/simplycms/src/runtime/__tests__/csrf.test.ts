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
      expect(shouldValidateCsrf(method, '/_serverFn/abc', new Headers())).toBe(
        false,
      );
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])(
    'змінюючий метод %s перевіряється',
    (method) => {
      expect(shouldValidateCsrf(method, '/_serverFn/abc', new Headers())).toBe(
        true,
      );
      expect(shouldValidateCsrf(method, '/api/health', new Headers())).toBe(
        true,
      );
    },
  );

  it('POST під винятком не перевіряється', () => {
    expect(
      shouldValidateCsrf('POST', '/api/auth/sign-in/email', new Headers()),
    ).toBe(false);
    expect(shouldValidateCsrf('DELETE', '/api/auth/', new Headers())).toBe(
      false,
    );
  });

  it('виняток — префікс із кінцевим слешем, а не підрядок', () => {
    // `/api/authx` і `/api/auth` без слеша не підпадають під виняток.
    expect(shouldValidateCsrf('POST', '/api/authx/hook', new Headers())).toBe(
      true,
    );
    expect(shouldValidateCsrf('POST', '/api/auth', new Headers())).toBe(true);
    expect(shouldValidateCsrf('POST', '/x/api/auth/y', new Headers())).toBe(
      true,
    );
  });

  it('список винятків — рівно Better Auth', () => {
    expect([...CSRF_EXEMPT_PREFIXES]).toEqual(['/api/auth/']);
  });
});

describe('shouldValidateCsrf: /api/v1 і заголовок Authorization', () => {
  const bearer = new Headers({ authorization: 'Bearer scms_abcd1234_x' });

  it('Bearer без Origin на /api/v1 не перевіряється', () => {
    expect(shouldValidateCsrf('POST', '/api/v1/languages.add', bearer)).toBe(
      false,
    );
  });

  it('cookie без Authorization на /api/v1 перевіряється', () => {
    expect(
      shouldValidateCsrf('POST', '/api/v1/languages.add', new Headers()),
    ).toBe(true);
  });

  it('Authorization: Basic перевіряється', () => {
    const basic = new Headers({ authorization: 'Basic abc' });
    expect(shouldValidateCsrf('POST', '/api/v1/languages.add', basic)).toBe(
      true,
    );
  });

  it('Bearer поза /api/v1 перевіряється: виняток не поширюється на інші шляхи', () => {
    expect(shouldValidateCsrf('POST', '/_serverFn/abc', bearer)).toBe(true);
    expect(shouldValidateCsrf('POST', '/api/v1x/op', bearer)).toBe(true);
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

  it('cookie-запит на /api/v1 без Origin → 403', async () => {
    const result = await server({
      request: new Request('https://shop.test/api/v1/languages.add', {
        method: 'POST',
        headers: { cookie: 'a=b' },
        body: '{}',
      }),
      next: () => 'next',
    });
    expect((result as Response).status).toBe(403);
  });

  it('Bearer-запит на /api/v1 без Origin проходить до адаптера', async () => {
    const result = await server({
      request: new Request('https://shop.test/api/v1/languages.add', {
        method: 'POST',
        headers: { authorization: 'Bearer scms_abcd1234_x' },
        body: '{}',
      }),
      next: () => 'next',
    });
    expect(result).toBe('next');
  });
});
