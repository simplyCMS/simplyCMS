import { describe, it, expect } from 'vitest';
import { PRICE_TYPE_CODE_RE, SLUG_RE } from '../slug';

describe('формати ідентифікаторів каталогу (Е4-7)', () => {
  it.each(['mono', 'tip-paneli', 'a1-b2'])('SLUG_RE приймає %s', (s) =>
    expect(SLUG_RE.test(s)).toBe(true),
  );
  it.each(['', 'Тип-панелі', 'Mono', 'a--b', '-a', 'a b'])(
    'SLUG_RE відкидає %j',
    (s) => expect(SLUG_RE.test(s)).toBe(false),
  );
  it.each(['retail', 'b2b_wholesale'])('PRICE_TYPE_CODE_RE приймає %s', (s) =>
    expect(PRICE_TYPE_CODE_RE.test(s)).toBe(true),
  );
  it.each(['', 'Retail', 'b2b-wholesale', 'оптова'])(
    'PRICE_TYPE_CODE_RE відкидає %j',
    (s) => expect(PRICE_TYPE_CODE_RE.test(s)).toBe(false),
  );
});
