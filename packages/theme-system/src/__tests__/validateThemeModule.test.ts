import { describe, expect, it } from 'vitest';
import { validateThemeModule } from '../validateThemeModule';

/** Фабрика валідного модуля теми v2 (свіжий обʼєкт на кожен тест). */
function makeValidModule(): Record<string, unknown> {
  return {
    manifest: {
      name: 'demo',
      displayName: 'Demo Theme',
      version: '1.0.0',
      engines: { simplycms: '^0.1.0' },
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
});
