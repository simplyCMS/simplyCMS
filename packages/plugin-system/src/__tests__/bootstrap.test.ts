import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hookRegistry } from '../HookRegistry';
import { bootstrapPlugins, type PluginRegistration } from '../bootstrap';
import type { PluginModule } from '../types';

/** Рядок таблиці `plugins` у мок-БД (лише поля, потрібні bootstrap-у). */
interface PluginRow {
  name: string;
  display_name: string;
  version: string;
  is_active: boolean;
  [key: string]: unknown;
}

/**
 * Мінімальний мок Supabase (патерн `engine-provider.test.tsx`): thenable-білдер
 * із `select/eq/order/insert`. Повертає стан таблиці, щоб перевіряти upsert.
 */
function createMockSupabase(initial: PluginRow[], signedIn = true) {
  const rows: PluginRow[] = [...initial];
  const inserted: PluginRow[] = [];

  const client = {
    auth: {
      getSession: async () => ({
        data: { session: signedIn ? { user: { id: 'u1' } } : null },
        error: null,
      }),
    },
    from(table: string) {
      if (table !== 'plugins') throw new Error(`unexpected table ${table}`);
      const filters: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        insert(values: PluginRow[]) {
          for (const value of values) {
            rows.push(value);
            inserted.push(value);
          }
          return Promise.resolve({ data: values, error: null });
        },
        then<TResult>(
          onfulfilled: (value: { data: PluginRow[]; error: null }) => TResult,
        ) {
          const data = rows.filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return Promise.resolve({ data, error: null }).then(onfulfilled);
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, rows, inserted };
}

/** Фабрика тестового модуля плагіна, що чіпляється на дашборд-віджети. */
function makeModule(name: string): PluginModule {
  return {
    manifest: { name, displayName: `Plugin ${name}`, version: '1.2.3' },
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
    hookRegistry.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('зареєстрований + активний у БД → хук у реєстрі', async () => {
    const { client } = createMockSupabase([
      {
        name: 'active-plugin',
        display_name: 'Plugin active-plugin',
        version: '1.2.3',
        is_active: true,
      },
    ]);

    await bootstrapPlugins([makeRegistration('active-plugin')], client);

    expect(hookRegistry.getPluginsForHook('admin.dashboard.widgets')).toContain(
      'active-plugin',
    );
  });

  it('активний у БД, але невідомий → без падіння + console.error', async () => {
    const { client } = createMockSupabase([
      {
        name: 'ghost-plugin',
        display_name: 'Ghost',
        version: '0.0.1',
        is_active: true,
      },
    ]);

    await expect(bootstrapPlugins([], client)).resolves.toBeUndefined();

    expect(hookRegistry.getRegisteredHooks()).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('ghost-plugin'),
    );
  });

  it('зареєстрований, але неактивний → хуків нема, рядок upsert-нуто', async () => {
    const { client, inserted } = createMockSupabase([]);

    await bootstrapPlugins([makeRegistration('quiet-plugin')], client);

    expect(hookRegistry.getRegisteredHooks()).toHaveLength(0);
    expect(inserted).toEqual([
      expect.objectContaining({
        name: 'quiet-plugin',
        display_name: 'Plugin quiet-plugin',
        version: '1.2.3',
        is_active: false,
      }),
    ]);
  });

  it('без сесії запис не пробується (RLS дозволяє INSERT лише адміну)', async () => {
    const { client, inserted } = createMockSupabase([], false);

    await bootstrapPlugins([makeRegistration('anon-plugin')], client);

    expect(inserted).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('наявний у БД рядок повторно не вставляється', async () => {
    const { client, inserted } = createMockSupabase([
      {
        name: 'known-plugin',
        display_name: 'Plugin known-plugin',
        version: '1.2.3',
        is_active: false,
      },
    ]);

    await bootstrapPlugins([makeRegistration('known-plugin')], client);

    expect(inserted).toHaveLength(0);
  });
});
