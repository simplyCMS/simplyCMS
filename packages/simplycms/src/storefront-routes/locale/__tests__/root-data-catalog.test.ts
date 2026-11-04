import { describe, expect, it, vi } from 'vitest';
import { getUiPack, resolveUiLocale } from 'simplycms/i18n';
import { cl, localeSet } from '../../../../test-harness/locale';
import { loadStorefrontRoot } from '../root-data';

vi.mock('../../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: { name: 'Shop' },
    siteUrl: '',
  }),
}));

// Реєстр каталогів має модульний кеш на файл тестів, тож шпигуни ставляться до першого
// завантаження й цей файл тримає лише один сценарій.
describe('loadStorefrontRoot: один каталог ядра на клієнт', () => {
  it('на /en/… з основною uk вантажиться base en і НЕ вантажиться base uk', async () => {
    const primary = cl('uk');
    const uk = vi.spyOn(
      getUiPack(resolveUiLocale(primary, primary)).ui,
      'base',
    );
    const en = vi.spyOn(
      getUiPack(resolveUiLocale(cl('en'), primary)).ui,
      'base',
    );

    const data = await loadStorefrontRoot(
      '/en/x',
      localeSet('uk', ['uk', 'en']),
    );

    expect(data.ui.locale).toBe('en');
    expect(en).toHaveBeenCalledTimes(1);
    expect(uk).not.toHaveBeenCalled();
  });
});
