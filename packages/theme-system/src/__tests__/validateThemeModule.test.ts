import { describe, expect, it } from 'vitest';
import { viewModelFixtures } from 'simplycms/contracts/views/fixtures';
import { THEME_VIEW_KEYS, validateThemeModule } from '../validateThemeModule';

/** Фабрика валідного модуля теми v2 (свіжий обʼєкт на кожен тест). */
function makeValidModule(): Record<string, unknown> {
  return {
    manifest: {
      name: 'demo',
      displayName: 'Demo Theme',
      version: '1.0.0',
      engines: { simplycms: '>=0.1.0' },
    },
    tokens: { primary: '221 83% 53%', radius: '0.5rem' },
    components: {
      Header: () => null,
      Footer: () => null,
    },
  };
}

describe('validateThemeModule', () => {
  it('приймає валідний модуль теми', () => {
    expect(() => validateThemeModule(makeValidModule())).not.toThrow();
  });

  it('відхиляє модуль без components.Header', () => {
    const mod = makeValidModule();
    delete (mod.components as Record<string, unknown>).Header;

    expect(() => validateThemeModule(mod)).toThrow(/Header/);
  });

  it('відхиляє модуль без components.Footer', () => {
    const mod = makeValidModule();
    delete (mod.components as Record<string, unknown>).Footer;

    expect(() => validateThemeModule(mod)).toThrow(/Footer/);
  });

  it('відхиляє модуль без manifest.engines', () => {
    const mod = makeValidModule();
    delete (mod.manifest as Record<string, unknown>).engines;

    expect(() => validateThemeModule(mod)).toThrow(/engines/);
  });

  it('відхиляє модуль без tokens', () => {
    const mod = makeValidModule();
    delete mod.tokens;

    expect(() => validateThemeModule(mod)).toThrow(/tokens/);
  });

  it('відхиляє не-обʼєкт', () => {
    expect(() => validateThemeModule(null)).toThrow();
    expect(() => validateThemeModule('theme')).toThrow();
  });

  it('відхиляє неповний manifest (без version)', () => {
    const mod = makeValidModule();
    delete (mod.manifest as Record<string, unknown>).version;

    expect(() => validateThemeModule(mod)).toThrow(/manifest/);
  });

  it('приймає модуль без messages (поле опційне)', () => {
    expect(() => validateThemeModule(makeValidModule())).not.toThrow();
  });

  it('приймає модуль із валідним messages', () => {
    const mod = makeValidModule();
    mod.messages = { uk: { 'theme.foo': 'бар' }, en: { 'theme.foo': 'bar' } };

    expect(() => validateThemeModule(mod)).not.toThrow();
  });

  it('відхиляє messages, що не є обʼєктом', () => {
    const mod = makeValidModule();
    mod.messages = 'not-an-object';

    expect(() => validateThemeModule(mod)).toThrow(/messages/);
  });

  it('відхиляє messages.<locale>, що не є обʼєктом', () => {
    const mod = makeValidModule();
    mod.messages = { uk: 'not-an-object' };

    expect(() => validateThemeModule(mod)).toThrow(/messages\.uk/);
  });

  it('відхиляє messages.<locale>.<key> нерядкового типу', () => {
    const mod = makeValidModule();
    mod.messages = { uk: { 'theme.foo': 42 } };

    expect(() => validateThemeModule(mod)).toThrow(/messages\.uk\.theme\.foo/);
  });

  it('приймає модуль без fonts (поле опційне)', () => {
    expect(() => validateThemeModule(makeValidModule())).not.toThrow();
  });

  it('приймає модуль із валідним fonts', () => {
    const mod = makeValidModule();
    mod.fonts = [
      { stylesheet: 'https://fonts.googleapis.com/css2?family=Inter' },
    ];

    expect(() => validateThemeModule(mod)).not.toThrow();
  });

  it('відхиляє fonts, що не є масивом', () => {
    const mod = makeValidModule();
    mod.fonts = { stylesheet: 'https://fonts.googleapis.com' };

    expect(() => validateThemeModule(mod)).toThrow(/fonts/);
  });

  it('відхиляє запис fonts без stylesheet-рядка', () => {
    const mod = makeValidModule();
    mod.fonts = [{ stylesheet: 42 }];

    expect(() => validateThemeModule(mod)).toThrow(/fonts\[0\]/);
  });
  it('приймає модуль без views (поле опційне — теми v2.x не міняються)', () => {
    expect(() => validateThemeModule(makeValidModule())).not.toThrow();
  });

  it('приймає модуль із валідним views', () => {
    const mod = makeValidModule();
    mod.views = { ProductDetail: () => null, Cart: () => null };

    expect(() => validateThemeModule(mod)).not.toThrow();
  });

  it('відхиляє views, що не є обʼєктом', () => {
    const mod = makeValidModule();
    mod.views = [];

    expect(() => validateThemeModule(mod)).toThrow(/views/);
  });

  it('відхиляє невідомий ключ views', () => {
    const mod = makeValidModule();
    mod.views = { Checkout: () => null };

    expect(() => validateThemeModule(mod)).toThrow(/Checkout/);
  });

  it('відхиляє views.<сторінка> нефункціонального типу', () => {
    const mod = makeValidModule();
    mod.views = { Home: 'HomeView' };

    expect(() => validateThemeModule(mod)).toThrow(/views\.Home/);
  });

  it('THEME_VIEW_KEYS перелічує рівно пʼять канонічних сторінок', () => {
    expect([...THEME_VIEW_KEYS]).toEqual([
      'Home',
      'Catalog',
      'CatalogSection',
      'ProductDetail',
      'Cart',
    ]);
  });

  // Звірка двох списків: ключі контракту (тут) і ключі фікстур (у T0
  // `simplycms/contracts`). Новий view без фікстури — червоний тест ще до
  // conformance-kit-а.
  it('кожен ключ контракту має фікстурний view-model', () => {
    expect(Object.keys(viewModelFixtures).sort()).toEqual(
      [...THEME_VIEW_KEYS].sort(),
    );
  });
});
