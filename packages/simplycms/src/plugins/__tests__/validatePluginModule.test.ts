import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validatePluginModule } from '../validatePluginModule';

/** Сирий модуль без SDK: валідатор працює по структурі, не по походженню. */
function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    manifest: {
      name: 'demo',
      displayName: 'Demo',
      version: '0.1.0',
      engines: { simplycms: '>=0.1.0' },
    },
    register: () => {},
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validatePluginModule', () => {
  it('не-модуль — throw (викликач вирішує, чи це skip)', () => {
    expect(() => validatePluginModule(null)).toThrow(/register/);
    expect(() => validatePluginModule({})).toThrow(/register/);
  });

  it('legacy-модуль без manifest — прохід із попередженням', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validatePluginModule({ register: () => {} })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('без manifest'));
  });

  it('модуль із сумісним діапазоном — чистий прохід без попереджень', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validatePluginModule(makeModule(), '0.3.0')).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('manifest без обовʼязкових полів — throw поіменно', () => {
    expect(() =>
      validatePluginModule(makeModule({ manifest: { name: 'demo' } }), '0.3.0'),
    ).toThrow(/manifest\.displayName/);
  });

  it('несумісний engines — попередження, НЕ throw (Р5: warn-режим на 0.x)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const module = makeModule({
      manifest: {
        name: 'demo',
        displayName: 'Demo',
        version: '0.1.0',
        engines: { simplycms: '^0.1.0' },
      },
    });
    expect(() => validatePluginModule(module, '0.3.0')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('не покриває ядро 0.3.0'),
    );
  });

  it('нерозбірливий діапазон — попередження з причиною', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const module = makeModule({
      manifest: {
        name: 'demo',
        displayName: 'Demo',
        version: '0.1.0',
        engines: { simplycms: '>=0.1.0 <1.0.0' },
      },
    });
    expect(() => validatePluginModule(module, '0.3.0')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('не розпарсився'),
    );
  });

  it('ключ messages без префікса plugin.<name>. — попередження', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const module = makeModule({
      messages: {
        uk: { 'plugin.demo.title': 'Заголовок', 'demo.title': 'Хибний' },
      },
    });
    expect(() => validatePluginModule(module, '0.3.0')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('без префікса "plugin.demo."'),
    );
  });

  it('settings, що не є Zod-схемою, — throw; справжня схема — чиста', () => {
    const invalid = makeModule({
      definition: { settings: { maxVisible: 5 } },
    });
    expect(() => validatePluginModule(invalid, '0.3.0')).toThrow(/Zod-схемою/);

    const valid = makeModule({
      definition: { settings: z.object({ maxVisible: z.number() }) },
    });
    expect(() => validatePluginModule(valid, '0.3.0')).not.toThrow();
  });
});
