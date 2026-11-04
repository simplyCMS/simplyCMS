import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_PACKS,
  getContentTools,
  getUiPack,
  languageOfConfigLocale,
  loadTranslator,
  resolveUiLocale,
} from 'simplycms/i18n';
import { cl, ui } from '../../../../test-harness/locale';

describe('мовні пакети', () => {
  it('поставляються uk і en', () => {
    expect([...LANGUAGE_PACKS.keys()].sort()).toEqual(['en', 'uk']);
    expect(getUiPack(ui('uk')).name).toBe('Українська');
    expect(getUiPack(ui('en')).code).toBe('en');
  });

  it('інструментів контенту для мови без пакета немає → null (легальний випадок)', () => {
    expect(getContentTools(cl('pt'))).toBeNull();
  });

  it('інструменти контенту — за ТОЧНИМ кодом, без пошуку за базовою мовою', () => {
    expect(getContentTools(cl('en-GB'))).toBeNull();
  });

  it('uk несе таблицю адрес КМУ-2010, en — ні', () => {
    expect(getContentTools(cl('uk'))?.slugify?.('Згорани')).toBe('zghorany');
    expect(getContentTools(cl('en'))?.slugify).toBeUndefined();
  });

  it('місце під пошук порожнє: tokenize не оголошено', () => {
    expect(getContentTools(cl('uk'))).not.toHaveProperty('tokenize');
    expect(getContentTools(cl('en'))).not.toHaveProperty('tokenize');
  });

  it('частина base пакета — той самий каталог, що віддає транслятор', async () => {
    expect((await getUiPack(ui('uk')).ui.base())['common.save']).toBe(
      'Зберегти',
    );
    expect((await getUiPack(ui('en')).ui.base())['common.save']).toBe('Save');
  });
});

describe('транслятор мови інтерфейсу', () => {
  it('мова з пакета — її рядок', async () => {
    expect((await loadTranslator(ui('en'), ['base']))('common.save')).toBe(
      'Save',
    );
    expect((await loadTranslator(ui('uk'), ['base']))('common.save')).toBe(
      'Зберегти',
    );
  });

  it('мова без пакета потрапляє на пакет основної мови через міст, а не через тихий uk', async () => {
    const pl = cl('pl');
    const viaUk = await loadTranslator(resolveUiLocale(pl, cl('uk')), ['base']);
    const viaEn = await loadTranslator(resolveUiLocale(pl, cl('en')), ['base']);
    expect(viaUk('common.save')).toBe('Зберегти');
    expect(viaEn('common.save')).toBe('Save');
  });

  it('підставляє параметри', async () => {
    expect(
      (await loadTranslator(ui('uk'), ['base']))('cart.items', { count: 3 }),
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
