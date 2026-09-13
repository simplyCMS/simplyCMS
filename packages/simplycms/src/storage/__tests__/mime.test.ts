import { describe, expect, it } from 'vitest';
import { sniffImageMime } from '../mime';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

describe('sniffImageMime', () => {
  it('PNG', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('image/png');
  });

  it('JPEG', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('image/jpeg');
  });

  it('GIF87a і GIF89a', () => {
    expect(sniffImageMime(concat(ascii('GIF87a'), bytes(0, 0, 0, 0, 0, 0)))).toBe('image/gif');
    expect(sniffImageMime(concat(ascii('GIF89a'), bytes(0, 0, 0, 0, 0, 0)))).toBe('image/gif');
  });

  it('WebP — RIFF ... WEBP', () => {
    expect(sniffImageMime(concat(ascii('RIFF'), bytes(1, 2, 3, 4), ascii('WEBP'), bytes(0, 0)))).toBe('image/webp');
  });

  it('AVIF — ftyp із брендом avif/avis', () => {
    expect(sniffImageMime(concat(bytes(0, 0, 0, 0x20), ascii('ftyp'), ascii('avif'), bytes(0, 0)))).toBe('image/avif');
    expect(sniffImageMime(concat(bytes(0, 0, 0, 0x20), ascii('ftyp'), ascii('avis'), bytes(0, 0)))).toBe('image/avif');
  });

  // 🔴 Це не «ще один негативний кейс»: SVG — виконуваний формат, і саме він
  // перетворює завантаження картинки на XSS. Рішення Е2-10.
  it('SVG відбивається, і з XML-прологом теж', () => {
    expect(sniffImageMime(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageMime(ascii('<?xml version="1.0"?><svg/>'))).toBeNull();
  });

  it('RIFF без WEBP (наприклад wav) відбивається', () => {
    expect(sniffImageMime(concat(ascii('RIFF'), bytes(1, 2, 3, 4), ascii('WAVE'), bytes(0, 0)))).toBeNull();
  });

  it('порожній і закороткий вхід → null', () => {
    expect(sniffImageMime(new Uint8Array())).toBeNull();
    expect(sniffImageMime(bytes(0x89, 0x50))).toBeNull();
  });
});
