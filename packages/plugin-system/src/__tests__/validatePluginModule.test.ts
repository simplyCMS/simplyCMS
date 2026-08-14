import { describe, expect, it } from 'vitest';
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

describe('validatePluginModule', () => {
  it('не-модуль — помилка без винятку', () => {
    expect(validatePluginModule(null).ok).toBe(false);
    expect(validatePluginModule({}).ok).toBe(false);
  });

  it('legacy-модуль без manifest — ok із попередженням', () => {
    const report = validatePluginModule({ register: () => {} });
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([expect.stringContaining('без manifest')]);
  });

  it('модуль із сумісним діапазоном — чистий', () => {
    expect(validatePluginModule(makeModule(), '0.3.0')).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
  });

  it('manifest без обовʼязкових полів — помилки поіменно', () => {
    const report = validatePluginModule(
      makeModule({ manifest: { name: 'demo' } }),
      '0.3.0',
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([
      expect.stringContaining('displayName'),
      expect.stringContaining('version'),
    ]);
    // Відсутність engines — попередження, не помилка (legacy-модулі).
    expect(report.warnings).toEqual([
      expect.stringContaining('engines.simplycms відсутній'),
    ]);
  });

  it('несумісний engines — попередження, НЕ помилка (Р5: warn-режим на 0.x)', () => {
    const module = makeModule({
      manifest: {
        name: 'demo',
        displayName: 'Demo',
        version: '0.1.0',
        engines: { simplycms: '^0.1.0' },
      },
    });
    const report = validatePluginModule(module, '0.3.0');
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      expect.stringContaining('не покриває ядро 0.3.0'),
    ]);
  });

  it('нерозбірливий діапазон — попередження з причиною', () => {
    const module = makeModule({
      manifest: {
        name: 'demo',
        displayName: 'Demo',
        version: '0.1.0',
        engines: { simplycms: '>=0.1.0 <1.0.0' },
      },
    });
    const report = validatePluginModule(module, '0.3.0');
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      expect.stringContaining('не розпарсився'),
    ]);
  });

  it('ключ messages без префікса plugin.<name>. — попередження', () => {
    const module = makeModule({
      messages: {
        uk: { 'plugin.demo.title': 'Заголовок', 'demo.title': 'Хибний' },
      },
    });
    const report = validatePluginModule(module, '0.3.0');
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([
      expect.stringContaining('без префікса "plugin.demo."'),
    ]);
  });

  it('settings, що не є Zod-схемою, — помилка; справжня схема — чиста', () => {
    const invalid = makeModule({
      definition: { settings: { maxVisible: 5 } },
    });
    expect(validatePluginModule(invalid, '0.3.0').ok).toBe(false);

    const valid = makeModule({
      definition: { settings: z.object({ maxVisible: z.number() }) },
    });
    expect(validatePluginModule(valid, '0.3.0').ok).toBe(true);
  });
});
