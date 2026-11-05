import { describe, expect, it } from 'vitest';
import { readPrimaryLocale } from '../primary-locale';

describe('readPrimaryLocale', () => {
  it('читає код з однорядкової мітки в одинарних лапках', () => {
    expect(
      readPrimaryLocale("defineConfig({\n  primaryLocale: 'en',\n})"),
    ).toBe('en');
    expect(
      readPrimaryLocale("  primaryLocale:   'pt-BR',\n  currency: 'BRL'"),
    ).toBe('pt-BR');
  });

  it('закоментований рядок вище справжнього не береться', () => {
    expect(
      readPrimaryLocale("// primaryLocale: 'en'\n  primaryLocale: 'uk',"),
    ).toBe('uk');
  });

  it('лише закоментована мітка → null', () => {
    expect(readPrimaryLocale("  // primaryLocale: 'en'")).toBeNull();
  });

  it('мітки немає → null', () => {
    expect(readPrimaryLocale("currency: 'UAH'")).toBeNull();
  });

  it('подвійні лапки не підтримуються: мітка — як у шаблоні', () => {
    expect(readPrimaryLocale('primaryLocale: "en"')).toBeNull();
  });
});
