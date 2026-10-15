import { describe, expect, it } from 'vitest';
import { normalizeStorefrontRequest } from '../../seo/normalize';
import type { LocaleSet } from '../resolve';

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en', 'pl'],
};

const run = (path: string) =>
  normalizeStorefrontRequest(new URL(path, 'http://localhost'), SET);

describe('normalizeStorefrontRequest', () => {
  it('/uk/x?utm_source=a → 301 /x?utm_source=a (query байт у байт)', () => {
    const res = run('/uk/x?utm_source=a');
    expect(res?.status).toBe(301);
    expect(res?.headers.get('location')).toBe('/x?utm_source=a');
  });

  it('/uk → 301 /; /uk/ → 301 / (один редірект)', () => {
    expect(run('/uk')?.headers.get('location')).toBe('/');
    expect(run('/uk/')?.headers.get('location')).toBe('/');
  });

  it('/pl/x при pl у draft → 404', () => {
    expect(run('/pl/x')?.status).toBe(404);
  });

  it('/en/x → null (пропуск до роутера)', () => {
    expect(run('/en/x')).toBeNull();
  });

  it('/x → null', () => {
    expect(run('/x')).toBeNull();
  });

  it('завершальний слеш: /x/ → 301 /x; корінь не чіпаємо', () => {
    expect(run('/x/')?.headers.get('location')).toBe('/x');
    expect(run('/')).toBeNull();
    expect(run('/en')).toBeNull();
  });

  it('/en/x/ → рівно ОДИН 301 на /en/x, і /en/x далі вже null (без циклу)', () => {
    const first = run('/en/x/?a=1');
    expect(first?.status).toBe(301);
    expect(first?.headers.get('location')).toBe('/en/x?a=1');
    expect(run('/en/x?a=1')).toBeNull();
  });

  it('/uk/x/ → один 301 одразу на кінцеву /x, а не через /uk/x', () => {
    expect(run('/uk/x/')?.headers.get('location')).toBe('/x');
  });

  it('/en/ → один 301 на /en', () => {
    expect(run('/en/')?.headers.get('location')).toBe('/en');
  });

  it.each([
    '/admin/x/',
    '/api/v1/a/',
    '/_serverFn/x',
    '/assets/a/',
    '/media/a/',
  ])('службовий %s не нормалізується', (path) => {
    expect(run(path)).toBeNull();
  });

  describe('відкритий редирект: Location завжди шлях на тому самому origin', () => {
    const ATTACKS = [
      '/uk//evil.example',
      '/uk//evil.example/',
      '/uk/\\evil.example',
      '/uk/%2F%2Fevil.example',
      '/en//catalog',
      '//evil.example',
      '/en/\\evil.example',
      '/uk///evil.example//x',
    ];
    it.each(ATTACKS)('%s', (path) => {
      const res = run(path);
      const location = res?.headers.get('location') ?? null;
      if (location !== null) {
        expect(location).toMatch(/^\/(?![/\\])/);
        expect(new URL(location, 'http://localhost').origin).toBe(
          'http://localhost',
        );
      } else {
        // Без редіректу — або пропуск до роутера (шлях і так безпечний), або 404.
        expect(res === null || res.status === 404).toBe(true);
      }
    });

    it('/uk//evil.example → 301 /evil.example (схлопнуто, не //evil.example)', () => {
      expect(run('/uk//evil.example')?.headers.get('location')).toBe(
        '/evil.example',
      );
    });

    it('/en//catalog → 301 /en/catalog', () => {
      expect(run('/en//catalog')?.headers.get('location')).toBe('/en/catalog');
    });
  });

  it.each(['/uk/api/health', '/en/api/health', '/en/media/x.png', '/uk/admin'])(
    'префікс мови над невітринним %s → 404 (без дубля адреси)',
    (path) => {
      expect(run(path)?.status).toBe(404);
    },
  );

  it('регістр сегмента: /UK/x — не мова, тож без редіректу', () => {
    expect(run('/UK/x')).toBeNull();
  });
});
