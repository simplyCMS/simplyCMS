import { describe, expect, it } from 'vitest';
import { MEDIA_URL_BASE, resolveMediaUrl, resolveMediaUrls } from '../media';

describe('resolveMediaUrl', () => {
  it('storage key → URL під базою', () => {
    expect(resolveMediaUrl('ab/ab000000-0000-4000-8000-000000000000.png')).toBe(
      '/media/ab/ab000000-0000-4000-8000-000000000000.png',
    );
  });

  it('абсолютний http(s) лишається як є', () => {
    expect(resolveMediaUrl('https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(resolveMediaUrl('http://example.com/a.jpg')).toBe(
      'http://example.com/a.jpg',
    );
  });

  it('data: і blob: лишаються як є — плейсхолдери сіду й локальні прев’ю', () => {
    const svg = 'data:image/svg+xml;charset=utf-8,<svg/>';
    expect(resolveMediaUrl(svg)).toBe(svg);
    expect(resolveMediaUrl('blob:http://localhost/x')).toBe(
      'blob:http://localhost/x',
    );
  });

  it('корене-відносний шлях лишається як є', () => {
    expect(resolveMediaUrl('/static/logo.svg')).toBe('/static/logo.svg');
  });

  it('порожнє, пробіли, null і undefined → null', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl('')).toBeNull();
    expect(resolveMediaUrl('   ')).toBeNull();
  });

  it('база без хвостового слеша — кінцевий URL без подвійного', () => {
    expect(resolveMediaUrl('ab/x.png', '/cdn/')).toBe('/cdn/ab/x.png');
    expect(resolveMediaUrl('ab/x.png', '/cdn')).toBe('/cdn/ab/x.png');
  });

  it('база за замовчуванням — MEDIA_URL_BASE', () => {
    expect(MEDIA_URL_BASE).toBe('/media');
    expect(resolveMediaUrl('ab/x.png')).toBe(`${MEDIA_URL_BASE}/ab/x.png`);
  });

  it('resolveMediaUrls викидає елементи, що резолвляться в null', () => {
    expect(
      resolveMediaUrls(['ab/x.png', '', '  ', 'https://e.com/y.jpg']),
    ).toEqual(['/media/ab/x.png', 'https://e.com/y.jpg']);
  });
});
