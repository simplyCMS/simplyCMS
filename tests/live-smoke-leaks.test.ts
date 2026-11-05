import { describe, expect, it } from 'vitest';
import { leaked } from '../scripts/live-smoke/leaks.mjs';

const found = (text: string): string[] => leaked(text, []);

describe('live:smoke LEAKS: SQL відрізняється від звичайного тексту', () => {
  it.each([
    'Failed query: select "id", "slug" from "sections" where "slug" = $1',
    'select "id", "slug" from "sections" where "slug" = $1',
    'SELECT * FROM products',
    'select "t"."id" from "t"',
    '<pre>select\n  "id"\nfrom "t"</pre>',
  ])('ловить SQL: %s', (sql) => {
    expect(found(sql)).not.toEqual([]);
  });

  it.each([
    '<script src="/assets/select-v9_YI4lp.js"></script>',
    '<select name=a><option>1</option></select> from here',
    'select from the list',
    'Select file.ext from the folder',
    'Please select an item from the menu',
  ])('не ловить безневинне: %s', (text) => {
    expect(found(text)).toEqual([]);
  });

  it('адреса БД у тексті — витік', () => {
    expect(leaked('connect 10.0.0.5:5432', ['10.0.0.5:5432'])).toEqual([
      '10.0.0.5:5432',
    ]);
  });
});
