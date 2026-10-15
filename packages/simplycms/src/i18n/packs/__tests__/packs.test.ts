import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_PACKS,
  createTranslator,
  getLanguagePack,
  languageOfConfigLocale,
} from 'simplycms/i18n';

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
    expect(createTranslator('en', 'uk')('common.save')).toBe('Save');
    expect(createTranslator('uk', 'en')('common.save')).toBe('Зберегти');
  });

  it('мова без пакета, фолбек uk → український рядок', () => {
    expect(createTranslator('pt', 'uk')('common.save')).toBe('Зберегти');
  });

  it('мова без пакета, фолбек en → англійський рядок (фолбек — основна мова магазину, не uk)', () => {
    expect(createTranslator('pt', 'en')('common.save')).toBe('Save');
  });

  it('ключ, відсутній і в мові, і у фолбеку, повертається як є', () => {
    const t = createTranslator('pt', 'xx');
    expect(t('common.save')).toBe('common.save');
    expect(t('missing.key' as Parameters<typeof t>[0])).toBe('missing.key');
  });

  it('підставляє параметри і для фолбека', () => {
    expect(createTranslator('pt', 'uk')('cart.items', { count: 3 })).toBe(
      'Товари (3)',
    );
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
