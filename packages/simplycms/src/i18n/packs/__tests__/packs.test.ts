import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_PACKS,
  createTranslator,
  getLanguagePack,
  languageOfConfigLocale,
  resolveUiLocale,
} from 'simplycms/i18n';
import { cl, ui } from '../../../../test-harness/locale';

describe('мовні пакети', () => {
  it('поставляються uk і en', () => {
    expect([...LANGUAGE_PACKS.keys()].sort()).toEqual(['en', 'uk']);
    expect(getLanguagePack('uk')?.name).toBe('Українська');
    expect(getLanguagePack('en')?.code).toBe('en');
  });

  it('невідомого пакета немає → null (мова без пакета — легальний випадок)', () => {
    expect(getLanguagePack('pt')).toBeNull();
    expect(getLanguagePack('')).toBeNull();
  });

  it('uk несе таблицю адрес КМУ-2010, en — ні', () => {
    expect(getLanguagePack('uk')?.slugify?.('Згорани')).toBe('zghorany');
    expect(getLanguagePack('en')?.slugify).toBeUndefined();
  });

  it('місце під пошук порожнє: tokenize не оголошено', () => {
    expect(getLanguagePack('uk')).not.toHaveProperty('tokenize');
    expect(getLanguagePack('en')).not.toHaveProperty('tokenize');
  });

  it('каталог пакета — той самий, що віддає транслятор', () => {
    expect(getLanguagePack('uk')?.catalog['common.save']).toBe('Зберегти');
    expect(getLanguagePack('en')?.catalog['common.save']).toBe('Save');
  });
});

describe('createTranslator(locale, fallback)', () => {
  it('мова з пакетом — її рядок', () => {
    expect(createTranslator(ui('en'), ui('uk'))('common.save')).toBe('Save');
    expect(createTranslator(ui('uk'), ui('en'))('common.save')).toBe(
      'Зберегти',
    );
  });

  it('мова без пакета потрапляє на пакет основної мови через міст, а не через тихий uk', () => {
    const pl = cl('pl');
    expect(
      createTranslator(resolveUiLocale(pl, cl('uk')), ui('uk'))('common.save'),
    ).toBe('Зберегти');
    expect(
      createTranslator(resolveUiLocale(pl, cl('en')), ui('en'))('common.save'),
    ).toBe('Save');
  });

  it('підставляє параметри', () => {
    expect(
      createTranslator(ui('uk'), ui('uk'))('cart.items', { count: 3 }),
    ).toBe('Товари (3)');
  });
});

describe('languageOfConfigLocale (тимчасовий міст до config.locale з регіоном, М2)', () => {
  it('зрізає регіон і регістр: uk-UA → uk, EN → en', () => {
    expect(languageOfConfigLocale('uk-UA')).toBe('uk');
    expect(languageOfConfigLocale('en-US')).toBe('en');
    expect(languageOfConfigLocale('EN')).toBe('en');
  });

  it('не прив’язується до наявності пакета: fr-FR → fr', () => {
    expect(languageOfConfigLocale('fr-FR')).toBe('fr');
  });
});
