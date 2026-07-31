import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeRegistry } from '../ThemeRegistry';

/** Мінімальний валідний модуль теми v2 */
function makeThemeModule(name: string) {
  return {
    manifest: {
      name,
      displayName: name,
      version: '1.0.0',
      engines: { simplycms: '^0.1.0' },
    },
    tokens: { primary: '221 83% 53%' },
    components: { Header: () => null, Footer: () => null },
  };
}

afterEach(() => {
  for (const name of ThemeRegistry.getRegisteredThemes()) {
    ThemeRegistry.unregister(name);
  }
  ThemeRegistry.clearCache();
  vi.restoreAllMocks();
});

describe('ThemeRegistry.load', () => {
  it('вантажить зареєстровану тему', async () => {
    ThemeRegistry.register('default', () =>
      Promise.resolve({ default: makeThemeModule('default') }),
    );

    const theme = await ThemeRegistry.load('default');
    expect(theme.manifest.name).toBe('default');
  });

  it('падає на "default", якщо запитану тему не зареєстровано', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    ThemeRegistry.register('default', () =>
      Promise.resolve({ default: makeThemeModule('default') }),
    );

    const theme = await ThemeRegistry.load('missing-theme');
    expect(theme.manifest.name).toBe('default');
  });

  it('reject, якщо ані запитаної теми, ані "default" не зареєстровано', async () => {
    await expect(ThemeRegistry.load('missing-theme')).rejects.toThrow(
      /missing-theme/,
    );
  });

  it('відхиляє тему, що не проходить валідацію контракту v2', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ThemeRegistry.register('broken', () =>
      Promise.resolve({ default: { manifest: { name: 'broken' } } }),
    );

    await expect(ThemeRegistry.load('broken')).rejects.toThrow();
  });

  it('повертає стабільну проміс-референцію (вимога React use())', () => {
    ThemeRegistry.register('default', () =>
      Promise.resolve({ default: makeThemeModule('default') }),
    );

    expect(ThemeRegistry.load('default')).toBe(ThemeRegistry.load('default'));
  });
});
