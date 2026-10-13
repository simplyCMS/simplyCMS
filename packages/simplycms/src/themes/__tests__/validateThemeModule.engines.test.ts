import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateThemeModule } from '../validateThemeModule';

// Версія ядра — константа, тож підміняємо її: тест не мусить ламатися на
// кожному релізі. Решта `contracts/semver` (satisfies) — справжня.
const core = vi.hoisted(() => ({ version: '2.0.0' }));
vi.mock('simplycms/contracts/semver', async (importActual) => {
  const actual =
    await importActual<typeof import('simplycms/contracts/semver')>();
  return {
    ...actual,
    get CORE_VERSION() {
      return core.version;
    },
  };
});

function themeWith(range: string): Record<string, unknown> {
  return {
    manifest: {
      name: 'demo',
      displayName: 'Demo Theme',
      version: '1.0.0',
      engines: { simplycms: range },
    },
    tokens: { primary: '221 83% 53%' },
    components: { Header: () => null, Footer: () => null },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateThemeModule: engines.simplycms і мажорна межа', () => {
  it('^1.0.0 проти ядра 2.0.0 — попередження, не throw', () => {
    core.version = '2.0.0';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateThemeModule(themeWith('^1.0.0'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('не покриває ядро 2.0.0'),
    );
  });

  it('^1.0.0 проти ядра 1.3.0 — тиша', () => {
    core.version = '1.3.0';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateThemeModule(themeWith('^1.0.0'));
    expect(warn).not.toHaveBeenCalled();
  });
});
