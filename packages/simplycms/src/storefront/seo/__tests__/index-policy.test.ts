import { describe, expect, it } from 'vitest';
import { indexPolicy, type IndexPolicyInput } from '../index-policy';

/** Магазин `uk` (основна) + `en` + `pl`; сутність `x` з адресою `x-en` в англійській. */
const VERSIONS: IndexPolicyInput['languages'] = [
  { code: 'uk', isTranslated: true, path: 'x' },
  { code: 'en', isTranslated: true, path: 'x-en' },
  { code: 'pl', isTranslated: false, path: 'x' },
];

const policy = (over: Partial<IndexPolicyInput>) =>
  indexPolicy({
    locale: 'uk',
    primary: 'uk',
    isTranslated: true,
    languages: VERSIONS,
    ...over,
  });

describe('indexPolicy (І33)', () => {
  it('перекладена версія: self-canonical і взаємний hreflang з x-default', () => {
    const en = policy({ locale: 'en' });
    expect(en).toMatchObject({
      indexable: true,
      robots: 'index, follow',
      canonical: '/en/x-en',
    });
    expect(en.hreflang).toEqual([
      { hrefLang: 'uk', href: '/x' },
      { hrefLang: 'en', href: '/en/x-en' },
      { hrefLang: 'x-default', href: '/x' },
    ]);
    // Взаємність: основна бачить той самий набір.
    expect(policy({}).hreflang).toEqual(en.hreflang);
  });

  it('неперекладена: noindex, canonical на основну, без hreflang', () => {
    const pl = policy({ locale: 'pl', isTranslated: false });
    expect(pl).toEqual({
      indexable: false,
      robots: 'noindex, follow',
      canonical: '/x',
      hreflang: [],
    });
  });

  it('неперекладену версію hreflang інших не згадує', () => {
    const hrefLangs = policy({}).hreflang.map((h) => h.hrefLang);
    expect(hrefLangs).not.toContain('pl');
  });

  it('ручний robots=index не перекриває noindex неперекладеного', () => {
    const pl = policy({
      locale: 'pl',
      isTranslated: false,
      robots: 'index, follow',
    });
    expect(pl.indexable).toBe(false);
    expect(pl.robots).toBe('noindex, follow');
  });

  it('ручний noindex перекладеної сторінки поважається і знімає її з hreflang', () => {
    const en = policy({ locale: 'en', robots: 'noindex, nofollow' });
    expect(en).toMatchObject({ indexable: false, robots: 'noindex, nofollow' });
    expect(en.hreflang).toEqual([]);
  });

  it('x-default = основна мова навіть для сторінки іншої мови', () => {
    const xDefault = policy({ locale: 'en' }).hreflang.find(
      (h) => h.hrefLang === 'x-default',
    );
    expect(xDefault?.href).toBe('/x');
  });

  it('canonical-override на інший URL: сторінка поза hreflang і sitemap', () => {
    const en = policy({
      locale: 'en',
      canonicalOverride: 'https://other.example/y',
    });
    expect(en).toMatchObject({
      indexable: false,
      canonical: 'https://other.example/y',
      hreflang: [],
    });
  });

  it('canonical-override на власний URL нічого не міняє', () => {
    const en = policy({ locale: 'en', canonicalOverride: '/en/x-en' });
    expect(en.indexable).toBe(true);
    expect(en.hreflang.length).toBe(3);
  });

  it('одномовний магазин: hreflang не виводиться', () => {
    const only = policy({
      languages: [{ code: 'uk', isTranslated: true, path: 'x' }],
    });
    expect(only).toMatchObject({ indexable: true, canonical: '/x' });
    expect(only.hreflang).toEqual([]);
  });

  it('код мови у префіксі — нижнім регістром', () => {
    const ptBr = indexPolicy({
      locale: 'pt-BR',
      primary: 'uk',
      isTranslated: true,
      languages: [
        { code: 'uk', isTranslated: true, path: 'x' },
        { code: 'pt-BR', isTranslated: true, path: 'x' },
      ],
    });
    expect(ptBr.canonical).toBe('/pt-br/x');
    expect(ptBr.hreflang[1]).toEqual({ hrefLang: 'pt-BR', href: '/pt-br/x' });
  });
});
