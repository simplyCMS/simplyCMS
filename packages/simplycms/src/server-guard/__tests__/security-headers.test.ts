import { describe, expect, it } from 'vitest';
import {
  HSTS_HEADER,
  SECURITY_HEADERS,
  securityHeaders,
  withSecurityHeaders,
} from '../security-headers';

const names = (list: ReadonlyArray<readonly [string, string]>) =>
  list.map(([name]) => name);

describe('securityHeaders (Р27)', () => {
  it('перелік дослівно з рішення Р27', () => {
    expect(Object.fromEntries(SECURITY_HEADERS)).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
  });

  it('HSTS — лише для https-сайту', () => {
    expect(names(securityHeaders('https://shop.test'))).toContain(
      HSTS_HEADER[0],
    );
    for (const site of ['http://shop.test', undefined, '', 'не url']) {
      expect(names(securityHeaders(site))).not.toContain(HSTS_HEADER[0]);
    }
  });
});

describe('withSecurityHeaders', () => {
  const handler = async () => new Response('ok', { status: 201 });

  it('дописує заголовки до відповіді хендлера, статус і тіло не міняє', async () => {
    const response = await withSecurityHeaders(
      handler,
      'https://shop.test',
    )(new Request('https://shop.test/'));

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe('ok');
    for (const [name, value] of securityHeaders('https://shop.test')) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it('заголовок, який хендлер виставив сам, не перебиває', async () => {
    const response = await withSecurityHeaders(
      async () => new Response('', { headers: { 'X-Frame-Options': 'DENY' } }),
      undefined,
    )(new Request('http://x/'));

    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('відповідь із незмінними заголовками (Response.redirect) теж отримує їх', async () => {
    const response = await withSecurityHeaders(
      async () => Response.redirect('https://shop.test/a', 302),
      undefined,
    )(new Request('http://x/'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://shop.test/a');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
