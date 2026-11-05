import { describe, expect, it, vi } from 'vitest';
import {
  getContentTools,
  getUiPack,
  hasLanguagePack,
  listLanguagePacks,
  loadTranslator,
  resolveUiLocale,
} from 'simplycms/i18n';
import { cl, ui } from '../../../../test-harness/locale';

// Тестовий реєстр: платформні `uk`/`en` + `de` і `pt` без частини `admin` (§19.15).
vi.mock('../registry', async (importOriginal) => {
  const { testPackRegistry } =
    await import('../../../../test-harness/language-packs');
  const real = await importOriginal<typeof import('../registry')>();
  return { PACKS: testPackRegistry(real.PACKS) };
});

describe('мовні пакети', () => {
  it('платформа постачає uk і en з усіма частинами', () => {
    const platform = listLanguagePacks().filter((p) =>
      ['uk', 'en'].includes(p.code),
    );
    expect(platform.map((p) => [p.code, p.parts])).toEqual([
      ['uk', ['base', 'admin', 'mail']],
      ['en', ['base', 'admin', 'mail']],
    ]);
    expect(getUiPack(ui('uk')).name).toBe('Українська');
    expect(getUiPack(ui('en')).code).toBe('en');
  });

  it('hasLanguagePack: точний код або базова мова (pt-BR → pt), чужа — ні', () => {
    expect(hasLanguagePack('pt-BR')).toBe(true);
    expect(hasLanguagePack('en')).toBe(true);
    expect(hasLanguagePack('pl')).toBe(false);
    expect(hasLanguagePack('не код')).toBe(false);
  });

  it("частина admin необов'язкова: пакет без неї — пакет вітрини, але не адмінки", () => {
    expect(hasLanguagePack('de')).toBe(true);
    expect(hasLanguagePack('de', ['admin'])).toBe(false);
    expect(hasLanguagePack('uk', ['admin'])).toBe(true);
    expect(listLanguagePacks().find((p) => p.code === 'de')?.parts).toEqual([
      'base',
      'mail',
    ]);
  });

  it('інструментів контенту для мови без пакета немає → null (легальний випадок)', () => {
    expect(getContentTools(cl('fr'))).toBeNull();
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

  it('деградований режим: мова без пакета потрапляє на пакет основної мови через міст, а не через тихий uk', async () => {
    const pl = cl('pl');
    const viaUk = await loadTranslator(resolveUiLocale(pl, cl('uk')), ['base']);
    const viaEn = await loadTranslator(resolveUiLocale(pl, cl('en')), ['base']);
    expect(viaUk('common.save')).toBe('Зберегти');
    expect(viaEn('common.save')).toBe('Save');
  });

  it('підставляє параметри', async () => {
    expect(
      (await loadTranslator(ui('uk'), ['base']))('cart.itemsTitle', {
        count: 3,
      }),
    ).toBe('Товари (3)');
  });
});
