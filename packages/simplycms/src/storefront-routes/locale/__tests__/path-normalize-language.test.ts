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

  it('регістр сегмента: /UK/x — не мова, тож без редіректу', () => {
    expect(run('/UK/x')).toBeNull();
  });
});
