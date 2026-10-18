import { describe, expect, it } from 'vitest';
import {
  localePrefixSegment,
  localizedPath,
  productPath,
} from '../product-path';

describe('productPath (М1, §3.2)', () => {
  it('основна мова: /<path> без префікса, to+params для роуту сутності', () => {
    const p = productPath({ path: 'boot', locale: 'uk', primary: 'uk' });
    expect(p.href).toBe('/boot');
    expect(p.to).toBe('/$path');
    expect(p.params).toEqual({ path: 'boot' });
  });

  it('інша мова: /<lower(code)>/<path>, а params без мови (її дописує rewrite)', () => {
    const p = productPath({ path: 'boot-en', locale: 'pt-BR', primary: 'uk' });
    expect(p.href).toBe('/pt-br/boot-en');
    expect(p.params).toEqual({ path: 'boot-en' });
  });

  it('без мови (адмінка, лист) — адреса основної мови', () => {
    expect(productPath({ path: 'boot' }).href).toBe('/boot');
  });

  it('шлях ніколи не містить подвійного слеша', () => {
    expect(
      productPath({ path: 'a', locale: 'en', primary: 'uk' }).href,
    ).not.toContain('//');
  });

  it('одне правило префікса (B M3): товар, SEO-шлях і сегмент мови збігаються', () => {
    expect(localePrefixSegment('pt-BR')).toBe('pt-br');
    expect(localizedPath('pt-BR', 'uk', 'x')).toBe(
      productPath({ path: 'x', locale: 'pt-BR', primary: 'uk' }).href,
    );
    expect(localizedPath('uk', 'uk', 'x')).toBe('/x');
    expect(localizedPath('en', 'uk', '')).toBe('/en');
  });
});
