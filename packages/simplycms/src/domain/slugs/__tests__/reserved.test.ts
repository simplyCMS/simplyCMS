import { describe, expect, it } from 'vitest';
import {
  RESERVED_QUERY_KEYS,
  RESERVED_SEGMENTS,
  isReservedPath,
  isReservedPropertyToken,
} from '../index';

// 🔴 Очікуваний перелік написано РУКАМИ (майстер §3.2), а не виведено з
// константи: `it.each(RESERVED_SEGMENTS)` сам по собі не помітив би, що з
// переліку зник елемент, — ітерував би вже усічений список.
const EXPECTED_SEGMENTS = [
  'admin',
  'api',
  'assets',
  'auth',
  'cart',
  'catalog',
  'checkout',
  'my',
  'media',
  'order-success',
  'profile',
  'properties',
  'search',
  'sitemap.xml',
  'robots.txt',
] as const;

const EXPECTED_QUERY_KEYS = [
  'mod',
  'page',
  'sort',
  'price',
  'in_stock',
  'q',
  'limit',
  'view',
] as const;

describe('RESERVED_SEGMENTS / RESERVED_QUERY_KEYS (§3.2)', () => {
  it('перелік сегментів збігається з майстром дослівно', () => {
    expect([...RESERVED_SEGMENTS].sort()).toEqual(
      [...EXPECTED_SEGMENTS].sort(),
    );
  });

  it('перелік ключів query збігається з майстром дослівно', () => {
    expect([...RESERVED_QUERY_KEYS].sort()).toEqual(
      [...EXPECTED_QUERY_KEYS].sort(),
    );
  });
});

describe('isReservedPath (І19)', () => {
  it.each(EXPECTED_SEGMENTS)('службовий сегмент %s заборонений', (segment) => {
    expect(isReservedPath(segment, [], [])).toBe(true);
  });

  it("код мови з languageSegments заборонений ('en', 'pt-br')", () => {
    expect(isReservedPath('en', ['en', 'pt-br'], [])).toBe(true);
    expect(isReservedPath('pt-br', ['en', 'pt-br'], [])).toBe(true);
  });

  it('код мови порівнюється без урахування регістру (сегмент URL = lower(code))', () => {
    expect(isReservedPath('pt-br', ['pt-BR'], [])).toBe(true);
  });

  it("ім'я з publicNames заборонене (favicon.ico)", () => {
    expect(isReservedPath('favicon.ico', [], ['favicon.ico'])).toBe(true);
  });

  it('звичайний шлях дозволений, а мова без запису в languageSegments — теж', () => {
    expect(isReservedPath('futbolka', ['en'], ['favicon.ico'])).toBe(false);
    expect(isReservedPath('de', ['en'], [])).toBe(false);
  });
});

describe('isReservedPropertyToken (§3.2: сегменти + ключі query)', () => {
  it.each(EXPECTED_QUERY_KEYS)('ключ query %s не може бути токеном', (key) => {
    expect(isReservedPropertyToken(key, [])).toBe(true);
  });

  it.each(EXPECTED_SEGMENTS)(
    'службовий сегмент %s не може бути токеном',
    (s) => {
      expect(isReservedPropertyToken(s, [])).toBe(true);
    },
  );

  it('код мови не може бути токеном', () => {
    expect(isReservedPropertyToken('en', ['en'])).toBe(true);
  });

  it('звичайний токен дозволений', () => {
    expect(isReservedPropertyToken('color', ['en'])).toBe(false);
  });
});
