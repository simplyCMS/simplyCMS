import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hookRegistry } from '../HookRegistry';
import { bootstrapPlugins, type PluginRegistration } from '../bootstrap';
import type { PluginBootstrapRow, PluginModule, PluginRecord } from '../types';

/**
 * 🔴 Мокається СЕРВЕРНА поверхня (`simplycms/plugins/server`), а не
 * Supabase-клієнт: після рішення B9 bootstrap не тримає клієнта до БД —
 * читання й запис рядків `plugins` живуть у serverFn. Юніт доводить
 * складання рядків і роботу з реєстром; право на запис доводить
 * `pnpm test:schema` проти живої БД.
 */
const rows: PluginRecord[] = [];
const inserted: PluginBootstrapRow[] = [];

vi.mock('simplycms/plugins/server', () => ({
  listPluginNames: async () => rows.map((row) => row.name),
  listActivePlugins: async () => rows.filter((row) => row.is_active),
  registerPlugins: async ({
    data,
  }: {
    data: { rows: PluginBootstrapRow[] };
  }) => {
    inserted.push(...data.rows);
    return data.rows.length;
  },
}));

/** Рядок «БД» у формі, яку віддає serverFn. */
function seedRow(name: string, isActive: boolean): void {
  rows.push({
    id: `id-${name}`,
    name,
    display_name: `Plugin ${name}`,
    version: '1.2.3',
    description: null,
    author: null,
    is_active: isActive,
    config: {},
    hooks: [],
    migrations_applied: [],
    installed_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
}

/** Фабрика тестового модуля плагіна, що чіпляється на дашборд-віджети. */
function makeModule(name: string): PluginModule {
  return {
    manifest: {
      name,
      displayName: `Plugin ${name}`,
      version: '1.2.3',
      hooks: [{ name: 'admin.dashboard.widgets' }],
    },
    register: (registry) =>
      registry.register('admin.dashboard.widgets', name, () => name),
    unregister: (registry) =>
      registry.unregister('admin.dashboard.widgets', name),
  };
}

function makeRegistration(name: string): PluginRegistration {
  const module = makeModule(name);
  return { name, module: async () => ({ default: module }) };
}

describe('bootstrapPlugins', () => {
  beforeEach(() => {
    rows.length = 0;
    inserted.length = 0;
    hookRegistry.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // validatePluginModule попереджає про відсутній engines у фабричних
    // модулях — це очікувано і не має шуміти у виводі тестів.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('зареєстрований + активний у БД → хук у реєстрі', async () => {
    seedRow('active-plugin', true);

    await bootstrapPlugins([makeRegistration('active-plugin')], true);

    expect(hookRegistry.getPluginsForHook('admin.dashboard.widgets')).toContain(
      'active-plugin',
    );
  });

  it('активний у БД, але невідомий → без падіння + console.error', async () => {
    seedRow('ghost-plugin', true);

    await expect(bootstrapPlugins([], true)).resolves.toBeUndefined();

    expect(hookRegistry.getRegisteredHooks()).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('ghost-plugin'),
    );
  });

  it('зареєстрований, але неактивний → хуків нема, рядок дописано', async () => {
    await bootstrapPlugins([makeRegistration('quiet-plugin')], true);

    expect(hookRegistry.getRegisteredHooks()).toHaveLength(0);
    expect(inserted).toEqual([
      {
        name: 'quiet-plugin',
        display_name: 'Plugin quiet-plugin',
        version: '1.2.3',
        description: null,
        author: null,
        // hooks їдуть із manifest — без них рядок від bootstrap був би
        // біднішим за сідовий, і адмінка показувала б порожній список.
        hooks: [{ name: 'admin.dashboard.widgets' }],
      },
    ]);
  });

  it('невалідний модуль (без register) → error-лог + пропуск, решта підключається', async () => {
    const broken: PluginRegistration = {
      name: 'broken-plugin',
      module: async () => ({ default: {} as never }),
    };

    await bootstrapPlugins([broken, makeRegistration('ok-plugin')], true);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('broken-plugin'),
      expect.anything(),
    );
    // Пропущений модуль не потрапив ні в реєстр, ні в БД; сусід — потрапив.
    expect(inserted.map((row) => row.name)).toEqual(['ok-plugin']);
  });

  it('без права запису рядок не пробується (запис — лише адміну)', async () => {
    await bootstrapPlugins([makeRegistration('anon-plugin')], false);

    expect(inserted).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('наявний у БД рядок повторно не вставляється', async () => {
    seedRow('known-plugin', false);

    await bootstrapPlugins([makeRegistration('known-plugin')], true);

    expect(inserted).toHaveLength(0);
  });
});
