import { describe, expect, it } from 'vitest';
import { readPrimaryLocale } from '../primary-locale';

describe('readPrimaryLocale', () => {
  it('читає код з однорядкової мітки в одинарних лапках', () => {
    expect(
      readPrimaryLocale("export default defineConfig({ primaryLocale: 'en' })"),
    ).toBe('en');
    expect(
      readPrimaryLocale("  primaryLocale:   'pt-BR',\n  currency: 'BRL'"),
    ).toBe('pt-BR');
  });

  it('мітки немає → null', () => {
    expect(readPrimaryLocale("currency: 'UAH'")).toBeNull();
  });

  it('подвійні лапки не підтримуються: мітка — як у шаблоні', () => {
    expect(readPrimaryLocale('primaryLocale: "en"')).toBeNull();
  });
});
